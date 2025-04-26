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
  metric: "waveCount" | "sessionCount" | "sessionDuration" | "longestWaveDuration" | "topSpeed";
  target: number;
  xpReward: number;
  isActive?: boolean;
  minRank?: number;
  pool?: "daily" | "weekly";
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
  duration?: number;
  longestWave?: number;
  maxSpeed?: number;
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
    const sessionDuration: number = sessionData.duration ?? 0;
    const sessionLongestWave: number = sessionData.longestWave ?? 0;
    const sessionMaxSpeed: number = sessionData.maxSpeed ?? 0;

    logger.log(
      `Processing session ${sessionId} for user ${userId}. ` +
      `Waves: ${sessionWaveCount}, Duration: ${sessionDuration}, ` +
      `Longest: ${sessionLongestWave}, Speed: ${sessionMaxSpeed}`
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
          if (!Object.prototype.hasOwnProperty.call(
            userProfile.activeGoals, goalId
          )) {
            continue;
          }

          const activeGoal = userProfile.activeGoals[goalId];
          const goalDef = allGoals[goalId];

          if (!goalDef || activeGoal.completed) continue;

          let skipProgress = false;
          if ((goalDef.type === "daily" || goalDef.type === "weekly") && activeGoal.lastReset) {
              const resetTimestamp = activeGoal.lastReset;
              if (goalDef.type === "daily") {
                  const resetDate = resetTimestamp.toDate();
                  const sessionDt = sessionDate.toDate();
                  const isDifferentDay =
                      resetDate.getFullYear() !== sessionDt.getFullYear() ||
                      resetDate.getMonth() !== sessionDt.getMonth() ||
                      resetDate.getDate() !== sessionDt.getDate();
                  if (isDifferentDay) {
                      logger.log(`Daily goal ${goalId} outside timeframe. Skipping.`);
                      skipProgress = true;
                  }
              } else {
                  const resetDate = resetTimestamp.toDate();
                  const sessionDt = sessionDate.toDate();
                  
                  const dayOfWeekReset = (resetDate.getDay() + 6) % 7; 
                  const dayOfWeekSession = (sessionDt.getDay() + 6) % 7; 
                  
                  const msSinceWeekStartReset = resetDate.getTime() - dayOfWeekReset * 24 * 60 * 60 * 1000;
                  const msSinceWeekStartSession = sessionDt.getTime() - dayOfWeekSession * 24 * 60 * 60 * 1000;
                  
                  const startOfWeekResetDay = new Date(msSinceWeekStartReset).setHours(0,0,0,0);
                  const startOfWeekSessionDay = new Date(msSinceWeekStartSession).setHours(0,0,0,0);

                  if (startOfWeekResetDay !== startOfWeekSessionDay) {
                     logger.log(`Weekly goal ${goalId} outside timeframe. Skipping.`);
                     skipProgress = true;
                  }
              }
          }
          if (skipProgress) continue;

          let progressMade = 0;
          if (goalDef.metric === "waveCount") {
            progressMade = sessionWaveCount;
          } else if (goalDef.metric === "sessionCount") {
            progressMade = 1;
          } else if (goalDef.metric === "sessionDuration") {
              progressMade = sessionDuration;
          } else if (goalDef.metric === "longestWaveDuration") {
              if (sessionLongestWave <= (activeGoal.progress ?? 0)) {
                   continue;
              }
          } else if (goalDef.metric === "topSpeed") {
              if (sessionMaxSpeed <= (activeGoal.progress ?? 0)) {
                   continue;
              }
          }

          const currentProgress = activeGoal.progress ?? 0;
          let newProgress = currentProgress;

          if (goalDef.metric === "longestWaveDuration") {
              if (sessionLongestWave > currentProgress) {
                  newProgress = sessionLongestWave;
              }
          } else if (goalDef.metric === "topSpeed") {
               if (sessionMaxSpeed > currentProgress) {
                  newProgress = sessionMaxSpeed;
              }
          } else if (progressMade > 0) {
              newProgress = currentProgress + progressMade; 
          }

          if (newProgress !== currentProgress) {
              updatedActiveGoals[goalId] = {
                  ...activeGoal,
                  progress: newProgress,
              };

              logger.log(
                  `Goal ${goalId}: Progress ${currentProgress} -> ${newProgress} / ${goalDef.target}`
              );

              if (newProgress >= goalDef.target) {
                  if (!activeGoal.completed) { 
                      updatedActiveGoals[goalId].completed = true;
                      xpGainedThisSession += goalDef.xpReward;
                      logger.log(
                          `Goal ${goalId} completed! Awarding ${goalDef.xpReward} XP.`
                      );
                  }
              }
          }
        }

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

          // Update the newRankLevel if it has increased
          if (potentialNewRank > userProfile.rankLevel) {
            newRankLevel = potentialNewRank;
            logger.log(
                `User ${userId}: Rank Up! Level ` +
                `${userProfile.rankLevel} -> ${newRankLevel}`
            );
            // Optionally: Add logic here to grant rank-up rewards or send notifications
          }
        }

        // 6. Update User Profile in Transaction
        // Prepare the update object, only including fields that changed
        const updateData: { [key: string]: any } = {};
        if (xpGainedThisSession > 0) {
            // Use FieldValue.increment for safe concurrent updates
            updateData.xp = FieldValue.increment(xpGainedThisSession);
        }
        if (newRankLevel !== userProfile.rankLevel) {
            updateData.rankLevel = newRankLevel;
        }
        // Check if activeGoals actually changed before including it
        if (JSON.stringify(updatedActiveGoals) !== JSON.stringify(userProfile.activeGoals)) {
            updateData.activeGoals = updatedActiveGoals;
        }

        // Only run the update if there's something to change
        if (Object.keys(updateData).length > 0) {
            transaction.update(userRef, updateData);
            logger.log(`User ${userId}: Profile updated`, updateData);
        } else {
             logger.log(`User ${userId}: No profile updates needed for this session.`);
        }
      });

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

// --- Cloud Function: Assign/Reset Daily/Weekly Goals (Scheduled v2) ---

// Configuration (Consider moving to Firestore later)
const GOALS_CONFIG = {
    maxDailyActive: 3,
    maxWeeklyActive: 2,
    weeklyResetDay: 1, // 0=Sun, 1=Mon, ..., 6=Sat
};

// Renamed conceptually, but keep exported name for trigger
export const assignDailyGoals = onSchedule(
  { schedule: "every day 00:00", timeZone: "UTC" }, 
  async (event) => {
    logger.log("Running Periodic Goal Assignment/Reset Job", event.scheduleTime);

    const goalsRef = db.collection("goals");
    const usersRef = db.collection("users");
    const nowTimestamp = admin.firestore.Timestamp.now();
    const today = nowTimestamp.toDate();
    const currentDayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    const isWeeklyResetDay = currentDayOfWeek === GOALS_CONFIG.weeklyResetDay;

    try {
      // 1. Get all potentially active goal definitions
      const allGoalsSnapshot = await goalsRef.where("isActive", "==", true).get();
      if (allGoalsSnapshot.empty) {
        logger.log("No active goals found in definitions.");
        return;
      }

      const allGoalDefs: { [id: string]: GoalDefinition } = {};
      const dailyPoolIds: string[] = [];
      const weeklyPoolIds: string[] = [];
      allGoalsSnapshot.forEach((doc) => {
        const goal = doc.data() as GoalDefinition;
        allGoalDefs[doc.id] = goal;
        if (goal.pool === "daily") dailyPoolIds.push(doc.id);
        if (goal.pool === "weekly") weeklyPoolIds.push(doc.id);
      });
      logger.log(`Found active daily pool goals: ${dailyPoolIds.length}`);
      logger.log(`Found active weekly pool goals: ${weeklyPoolIds.length}`);

      // 2. Get all users (Batching needed for > ~500 users typically)
      const usersSnapshot = await usersRef.get();
      if (usersSnapshot.empty) {
        logger.log("No users found.");
        return;
      }

      const updatePromises: Promise<admin.firestore.WriteResult>[] = [];

      // 3. Iterate through each user
      usersSnapshot.forEach((userDoc) => {
        const userId = userDoc.id;
        const userProfile = userDoc.data() as Partial<UserProfile>;
        const currentRank = userProfile.rankLevel ?? 1;
        const currentActiveGoalsMap = userProfile.activeGoals ?? {};
        const nextActiveGoalsMap: { [goalId: string]: ActiveGoal } = { ...currentActiveGoalsMap }; 
        let needsUpdate = false;

        const eligibleDailyPool = dailyPoolIds.filter(id => 
            (allGoalDefs[id]?.minRank ?? 0) <= currentRank
        );
        const eligibleWeeklyPool = weeklyPoolIds.filter(id => 
            (allGoalDefs[id]?.minRank ?? 0) <= currentRank
        );

        const goalsToRemove: string[] = [];
        Object.keys(nextActiveGoalsMap).forEach(goalId => {
            const activeGoal = nextActiveGoalsMap[goalId];
            const definition = allGoalDefs[goalId];

            if (!definition || !definition.isActive) {
                logger.log(`User ${userId}: Removing inactive/missing goal ${goalId}`);
                goalsToRemove.push(goalId);
                needsUpdate = true;
                return;
            }

            if (definition.type === "daily") {
                let needsDailyReset = false;
                if (!activeGoal.lastReset) needsDailyReset = true;
                else {
                    const resetDate = activeGoal.lastReset.toDate();
                    if (resetDate.setHours(0,0,0,0) < today.setHours(0,0,0,0)) {
                        needsDailyReset = true;
                    }
                }
                if (needsDailyReset && (activeGoal.progress !== 0 || activeGoal.completed)) {
                    logger.log(`User ${userId}: Resetting daily goal ${goalId}`);
                    nextActiveGoalsMap[goalId] = { progress: 0, completed: false, lastReset: nowTimestamp };
                    needsUpdate = true;
                }
            }
            
            if (definition.type === "weekly" && isWeeklyResetDay) {
                 let needsWeeklyReset = false;
                 if (!activeGoal.lastReset) needsWeeklyReset = true;
                 else { 
                    const resetDate = activeGoal.lastReset.toDate();
                    const dayOfWeekReset = (resetDate.getDay() + 6) % 7; 
                    const msSinceWeekStartReset = resetDate.getTime() - dayOfWeekReset * 24 * 60 * 60 * 1000;
                    const startOfWeekResetDay = new Date(msSinceWeekStartReset).setHours(0,0,0,0);
                    const currentDayOfWeekCorrected = (today.getDay() + 6) % 7;
                    const msSinceCurrentWeekStart = today.getTime() - currentDayOfWeekCorrected * 24 * 60 * 60 * 1000;
                    const startOfCurrentWeekDay = new Date(msSinceCurrentWeekStart).setHours(0,0,0,0);
                    
                    if(startOfWeekResetDay < startOfCurrentWeekDay) needsWeeklyReset = true;
                 }
                 if (activeGoal.completed) needsWeeklyReset = true; 

                 if (needsWeeklyReset && (activeGoal.progress !== 0 || activeGoal.completed)) {
                      logger.log(`User ${userId}: Resetting weekly goal ${goalId}`);
                      nextActiveGoalsMap[goalId] = { progress: 0, completed: false, lastReset: nowTimestamp };
                      needsUpdate = true;
                 }
            }
        });

        goalsToRemove.forEach(goalId => delete nextActiveGoalsMap[goalId]);

        const currentDailyGoals = Object.keys(nextActiveGoalsMap).filter(id => allGoalDefs[id]?.type === "daily");
        const dailyNeeded = GOALS_CONFIG.maxDailyActive - currentDailyGoals.length;
        if (dailyNeeded > 0) {
            const availableDaily = eligibleDailyPool.filter(id => !nextActiveGoalsMap[id]);
            const shuffledDaily = availableDaily.sort(() => 0.5 - Math.random());
            const newDaily = shuffledDaily.slice(0, dailyNeeded);
            if (newDaily.length > 0) {
                 logger.log(`User ${userId}: Assigning ${newDaily.length} new daily goals: ${newDaily.join(", ")}`);
                 newDaily.forEach(goalId => {
                     nextActiveGoalsMap[goalId] = { progress: 0, completed: false, lastReset: nowTimestamp };
                     needsUpdate = true;
                 });
             }
        }

        if (isWeeklyResetDay) {
            const currentWeeklyGoals = Object.keys(nextActiveGoalsMap).filter(id => allGoalDefs[id]?.type === "weekly");
            const weeklyNeeded = GOALS_CONFIG.maxWeeklyActive - currentWeeklyGoals.length;
             if (weeklyNeeded > 0) {
                const availableWeekly = eligibleWeeklyPool.filter(id => !nextActiveGoalsMap[id]);
                const shuffledWeekly = availableWeekly.sort(() => 0.5 - Math.random());
                const newWeekly = shuffledWeekly.slice(0, weeklyNeeded);
                 if (newWeekly.length > 0) {
                    logger.log(`User ${userId}: Assigning ${newWeekly.length} new weekly goals: ${newWeekly.join(", ")}`);
                    newWeekly.forEach(goalId => {
                        nextActiveGoalsMap[goalId] = { progress: 0, completed: false, lastReset: nowTimestamp };
                        needsUpdate = true;
                    });
                }
            }
        }

        if (needsUpdate || (JSON.stringify(nextActiveGoalsMap) !== JSON.stringify(currentActiveGoalsMap))) {
          const userRef = usersRef.doc(userId);
          updatePromises.push(userRef.update({ activeGoals: nextActiveGoalsMap }));
        } 
      }); // End user loop

      // 4. Wait for all updates
      await Promise.all(updatePromises);
      logger.log(
        `Periodic goal assignment job potentially updated ${updatePromises.length} users.`
      );
    } catch (error) {
      logger.error("Error running periodic goal assignment job:", error);
    }
  }
);

// --- Optional: Assign Initial Goals on User Creation (v2) ---
export const assignInitialGoals = onDocumentCreated(
  "users/{userId}", // Trigger on user profile creation
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.log("No data associated with initial user creation event");
      return;
    }
    const userId = event.params.userId;
    // Get initial user data, rank will default to 1 if missing
    const userProfileData = snap.data() as Partial<UserProfile>; 
    const initialRank = userProfileData.rankLevel ?? 1;
    logger.log(`Assigning initial goals for new user ${userId} at Rank ${initialRank}`);

    const goalsRef = db.collection("goals");
    const userRef = db.collection("users").doc(userId);

    try {
      // 1. Fetch all ACTIVE goal definitions
      const goalsSnapshot = await goalsRef.where("isActive", "==", true).get();
      if (goalsSnapshot.empty) {
        logger.log("No active goals found to initially assign.");
        return;
      }

      const initialActiveGoalsMap: { [goalId: string]: ActiveGoal } = {};
      const nowTimestamp = admin.firestore.Timestamp.now();

      // Separate goals by type/pool and filter by initial rank
      const lifetimeGoalsToAdd: GoalDefinition[] = [];
      const eligibleDailyPool: GoalDefinition[] = [];
      const eligibleWeeklyPool: GoalDefinition[] = [];

      goalsSnapshot.forEach((goalDoc) => {
        const goalDef = { goalId: goalDoc.id, ...goalDoc.data() } as GoalDefinition;
        const goalMinRank = goalDef.minRank ?? 0; // Default to 0 if undefined

        if (goalDef.type === "lifetime") {
          // Add all active lifetime goals (rank filter could be added if needed)
          lifetimeGoalsToAdd.push(goalDef);
        } else if (goalMinRank <= initialRank) { // Check rank for pool goals
          if (goalDef.pool === "daily") {
            eligibleDailyPool.push(goalDef);
          } else if (goalDef.pool === "weekly") {
            eligibleWeeklyPool.push(goalDef);
          }
        }
      });

      // 2. Add all lifetime goals
      lifetimeGoalsToAdd.forEach(goalDef => {
           initialActiveGoalsMap[goalDef.goalId] = {
               progress: 0,
               completed: false,
               // No lastReset needed for lifetime typically
           };
           logger.log(`Assigning lifetime goal: ${goalDef.goalId}`);
       });

      // 3. Select and add initial Daily goals
      const shuffledDaily = eligibleDailyPool.sort(() => 0.5 - Math.random());
      // Ensure we don't try to slice more than available
      const countDailyToAssign = Math.min(shuffledDaily.length, GOALS_CONFIG.maxDailyActive);
      const dailyToAssign = shuffledDaily.slice(0, countDailyToAssign);
      if (dailyToAssign.length > 0) {
          logger.log(`Assigning ${dailyToAssign.length} initial daily goals: ${dailyToAssign.map(g=>g.goalId).join(", ")}`);
          dailyToAssign.forEach(goalDef => {
              initialActiveGoalsMap[goalDef.goalId] = {
                  progress: 0,
                  completed: false,
                  lastReset: nowTimestamp, 
              };
          });
      }
      
      // 4. Select and add initial Weekly goals
      const shuffledWeekly = eligibleWeeklyPool.sort(() => 0.5 - Math.random());
      // Ensure we don't try to slice more than available
      const countWeeklyToAssign = Math.min(shuffledWeekly.length, GOALS_CONFIG.maxWeeklyActive);
      const weeklyToAssign = shuffledWeekly.slice(0, countWeeklyToAssign);
       if (weeklyToAssign.length > 0) {
           logger.log(`Assigning ${weeklyToAssign.length} initial weekly goals: ${weeklyToAssign.map(g=>g.goalId).join(", ")}`);
           weeklyToAssign.forEach(goalDef => {
               initialActiveGoalsMap[goalDef.goalId] = {
                   progress: 0,
                   completed: false,
                   lastReset: nowTimestamp, 
               };
           });
       }

      // 5. Update user profile if any goals were added
      if (Object.keys(initialActiveGoalsMap).length > 0) {
        // Use update to only set the activeGoals field, preserving other signup data
        await userRef.update({ activeGoals: initialActiveGoalsMap }); 
        logger.log(`Initial goals map assigned for user ${userId}.`);
      } else {
        logger.log(
          `No initial goals found or eligible for user ${userId}.`
        );
      }
    } catch (error) {
      logger.error(`Error assigning initial goals for user ${userId}:`, error);
    }
  }
);
