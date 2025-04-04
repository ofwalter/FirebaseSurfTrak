import { logger } from "firebase-functions";
import {
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

admin.initializeApp();
const db = admin.firestore();

// --- Interfaces ---
interface GoalDefinition {
  goalId: string;
  description: string;
  type: "daily" | "weekly" | "lifetime";
  metric: "waveCount" | "sessionCount";
  target: number;
  xpReward: number;
}

interface RankDefinition {
  rankLevel: number;
  name: string;
  xpThreshold: number;
}

interface ActiveGoal {
  progress: number;
  completed: boolean;
  lastReset?: admin.firestore.Timestamp;
}

interface UserProfile {
  xp: number;
  rankLevel: number;
  activeGoals: { [goalId: string]: ActiveGoal };
  uid: string;
  name: string;
  email: string;
  // birthday?: string;
  // createdAt?: admin.firestore.Timestamp;
}

interface SessionData {
  userId: string;
  waveCount?: number;
  sessionDate?: admin.firestore.Timestamp;
}


// --- Cloud Function: Process Session for Goals (v2) ---
export const processSessionForGoals = onDocumentCreated(
  "sessions/{sessionId}",
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.log("No data associated with the event");
      return;
    }
    const sessionData = snap.data() as SessionData;
    const sessionId = event.params.sessionId;

    if (!sessionData || !sessionData.userId) {
      logger.log(`Session ${sessionId} missing data or userId.`);
      return;
    }

    const userId: string = sessionData.userId;
    const sessionWaveCount: number = sessionData.waveCount ?? 0;
    const sessionDate: admin.firestore.Timestamp =
        sessionData.sessionDate ?? admin.firestore.Timestamp.now();

    logger.log(
      `Processing session ${sessionId} for user ${userId}. ` +
      `Wave count: ${sessionWaveCount}`
    );

    const userRef = db.collection("users").doc(userId);
    const goalsRef = db.collection("goals");
    const ranksRef = db.collection("ranks");

    try {
      await db.runTransaction(async (transaction) => {
        // 1. Get User Profile
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          logger.log(`User profile ${userId} not found.`);
          return;
        }
        const userProfileData = userDoc.data() as Partial<UserProfile>;

        // Initialize missing fields (Lazy Initialization)
        const userProfile: UserProfile = {
          xp: userProfileData.xp ?? 0,
          rankLevel: userProfileData.rankLevel ?? 1,
          activeGoals: userProfileData.activeGoals ?? {},
          uid: userProfileData.uid ?? userId,
          name: userProfileData.name ?? "Unknown",
          email: userProfileData.email ?? "Unknown",
        };

        let xpGainedThisSession = 0;
        let newRankLevel = userProfile.rankLevel;
        const updatedActiveGoals = {...userProfile.activeGoals};

        // 2. Get All Goal Definitions
        const goalsSnapshot = await transaction.get(goalsRef);
        const allGoals: { [id: string]: GoalDefinition } = {};
        goalsSnapshot.forEach((doc) => {
          allGoals[doc.id] = doc.data() as GoalDefinition;
        });

        // 3. Process Active Goals
        for (const goalId in userProfile.activeGoals) {
          // Use hasOwnProperty check safely
          if (!Object.prototype.hasOwnProperty.call(
            userProfile.activeGoals, goalId
          )) {
            continue;
          }

          const activeGoal = userProfile.activeGoals[goalId];
          const goalDef = allGoals[goalId];

          if (!goalDef) {
            logger.log(
              `Goal definition ${goalId} not found. ` +
              "Skipping."
            );
            continue;
          }

          if (activeGoal.completed) continue; // Skip completed

          // Basic daily check
          if (goalDef.type === "daily" && activeGoal.lastReset) {
            const resetDate = activeGoal.lastReset.toDate();
            const sessionDt = sessionDate.toDate();
            const isDifferentDay =
                            resetDate.getFullYear() !== sessionDt.getFullYear() ||
                            resetDate.getMonth() !== sessionDt.getMonth() ||
                            resetDate.getDate() !== sessionDt.getDate();
            if (isDifferentDay) {
              logger.log(
                `Daily goal ${goalId} needs reset. ` +
                "Skipping progress." // Shortened log
              );
              continue;
            }
          }

          let progressMade = 0;
          if (goalDef.metric === "waveCount") {
            progressMade = sessionWaveCount;
          } else if (goalDef.metric === "sessionCount") {
            progressMade = 1;
          }

          if (progressMade > 0) {
            const currentProgress = activeGoal.progress ?? 0;
            const newProgress = currentProgress + progressMade;
            updatedActiveGoals[goalId] = {
              ...activeGoal,
              progress: newProgress,
            };

            logger.log(
              `Goal ${goalId}: Progress ${currentProgress} + ${progressMade} ` +
              `-> ${newProgress} / ${goalDef.target}`
            );

            // 4. Check for Goal Completion
            if (!activeGoal.completed && newProgress >= goalDef.target) {
              updatedActiveGoals[goalId].completed = true;
              xpGainedThisSession += goalDef.xpReward;
              logger.log(
                `Goal ${goalId} completed! Awarding ${goalDef.xpReward} XP.`
              );
            }
          }
        } // End processing active goals loop

        // 5. Check for Rank Up
        if (xpGainedThisSession > 0) {
          const newTotalXp = userProfile.xp + xpGainedThisSession;
          logger.log(
            `User ${userId}: XP ${userProfile.xp} + ` +
            `${xpGainedThisSession} -> ${newTotalXp}`
          );

          const ranksSnapshot = await transaction.get(
            ranksRef.orderBy("xpThreshold", "asc")
          );
          const allRanks: RankDefinition[] = [];
          ranksSnapshot.forEach((doc) =>
            allRanks.push(doc.data() as RankDefinition)
          );

          let potentialNewRank = userProfile.rankLevel;
          for (const rank of allRanks) {
            if (newTotalXp >= rank.xpThreshold) {
              potentialNewRank = rank.rankLevel;
            } else {
              break;
            }
          }

          if (potentialNewRank > userProfile.rankLevel) {
            newRankLevel = potentialNewRank;
            logger.log(`User ${userId} ranked up to Level ${newRankLevel}!`);
          }

          // 6. Update User Profile (XP gain)
          transaction.update(userRef, {
            xp: FieldValue.increment(xpGainedThisSession),
            rankLevel: newRankLevel,
            activeGoals: updatedActiveGoals,
          });
        } else if (
          JSON.stringify(updatedActiveGoals) !==
                    JSON.stringify(userProfile.activeGoals)
        ) {
          // Update activeGoals only if they changed but no XP was gained
          transaction.update(userRef, {
            activeGoals: updatedActiveGoals,
          });
        }
      }); // End transaction

      logger.log(
        `Successfully processed session ${sessionId} for user ${userId}.`
      );
    } catch (error) {
      logger.error(
        `Error processing session ${sessionId} for user ${userId}:`,
        error
      );
    }
  }
);

// --- Cloud Function: Assign/Reset Daily Goals (Scheduled v2) ---
export const assignDailyGoals = onSchedule(
  { schedule: "every day 00:00", timeZone: "UTC" },
  async (event) => {
    logger.log("Running daily goal assignment/reset job.", event.scheduleTime);

    const goalsRef = db.collection("goals");
    const usersRef = db.collection("users");

    try {
      // 1. Get all defined Daily goals
      const dailyGoalsSnapshot = await goalsRef.where("type", "==", "daily").get();
      if (dailyGoalsSnapshot.empty) {
        logger.log("No daily goals found.");
        return;
      }

      const dailyGoalDefs: { [id: string]: GoalDefinition } = {};
      dailyGoalsSnapshot.forEach((doc) => {
        dailyGoalDefs[doc.id] = doc.data() as GoalDefinition;
      });
      const dailyGoalIds = Object.keys(dailyGoalDefs);
      logger.log("Found daily goals:", dailyGoalIds.join(", "));

      // 2. Get all users
      const usersSnapshot = await usersRef.get();
      if (usersSnapshot.empty) {
        logger.log("No users found.");
        return;
      }

      const updatePromises: Promise<admin.firestore.WriteResult>[] = [];
      const nowTimestamp = admin.firestore.Timestamp.now();
      const today = nowTimestamp.toDate();

      // 3. Iterate through each user
      usersSnapshot.forEach((userDoc) => {
        const userId = userDoc.id;
        const userProfile = userDoc.data() as Partial<UserProfile>;
        const currentActiveGoals = userProfile.activeGoals ?? {};
        const goalsToUpdate: { [goalId: string]: ActiveGoal } = {
          ...currentActiveGoals,
        };
        let needsUpdate = false;

        for (const goalId of dailyGoalIds) {
          const existingGoal = currentActiveGoals[goalId];
          let needsReset = false;

          if (!existingGoal) {
            needsReset = true; // Add if missing
          } else {
            // Check if reset is needed
            if (existingGoal.lastReset) {
              const resetDate = existingGoal.lastReset.toDate();
              const isDifferentDay =
                                resetDate.getFullYear() !== today.getFullYear() ||
                                resetDate.getMonth() !== today.getMonth() ||
                                resetDate.getDate() !== today.getDate();
              if (isDifferentDay) {
                needsReset = true;
              }
            } else {
              needsReset = true; // Reset if lastReset missing
            }
            if (existingGoal.completed) {
              needsReset = true; // Always reset if completed
            }
          }

          if (needsReset) {
            goalsToUpdate[goalId] = {
              progress: 0,
              completed: false,
              lastReset: nowTimestamp,
            };
            needsUpdate = true;
          }
        } // End daily goal loop

        if (needsUpdate) {
          const userRef = usersRef.doc(userId);
          updatePromises.push(userRef.update({ activeGoals: goalsToUpdate }));
        }
      }); // End user loop

      // 4. Wait for all updates
      await Promise.all(updatePromises);
      logger.log(
        "Daily goal assignment potentially updated " +
        `${updatePromises.length} users.`
      );
    } catch (error) {
      logger.error("Error running daily goal assignment job:", error);
    }
  }
);

// --- Optional: Assign Initial Goals on User Creation (v2) ---
export const assignInitialGoals = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.log("No data associated with initial user creation event");
      return;
    }
    const userId = event.params.userId;
    const userProfileData = snap.data() as Partial<UserProfile>;
    logger.log(`Assigning initial goals for new user ${userId}`);

    const goalsRef = db.collection("goals");
    const userRef = db.collection("users").doc(userId);

    try {
      const goalsSnapshot = await goalsRef.get();
      if (goalsSnapshot.empty) {
        logger.log("No goals found to initially assign.");
        return;
      }

      const initialActiveGoals: { [goalId: string]: ActiveGoal } =
            userProfileData.activeGoals ?? {};
      let needsUpdate = false;
      const nowTimestamp = admin.firestore.Timestamp.now();

      goalsSnapshot.forEach((goalDoc) => {
        const goalDef = goalDoc.data() as GoalDefinition;
        const goalId = goalDoc.id;

        if (!initialActiveGoals[goalId]) {
          initialActiveGoals[goalId] = {
            progress: 0,
            completed: false,
            ...(goalDef.type === "daily" ? { lastReset: nowTimestamp } : { }),
          };
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        await userRef.update({ activeGoals: initialActiveGoals });
        logger.log(`Initial goals assigned for user ${userId}.`);
      } else {
        logger.log(
          `User ${userId} already had goals or no new goals to assign.`
        );
      }
    } catch (error) {
      logger.error(`Error assigning initial goals for user ${userId}:`, error);
    }
  }
); // Ensure file ends with a newline
