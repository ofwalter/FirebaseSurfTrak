GOAL SYSTEM:

Okay, implementing a full goal and ranking system adds a really engaging layer! Here's a breakdown of how you could approach the logic and data structure using Firebase, keeping scalability and reliability in mind:

**1. Data Structure (Firestore)**

The key is storing user-specific progress and linking it to defined goals.

*   **`userProfiles/{userId}` Document:** We'd expand this document (or create it if it doesn't exist) to hold all goal-related info for a user.
    *   `xp`: (Number) Total experience points earned.
    *   `rank`: (Number or String) The user's current rank/level (e.g., 1, 2, "Pro").
    *   `activeGoals`: (Map/Object) Stores the user's current progress on *active* goals. The keys could be `goalId`s.
        *   Example:
            ```json
            activeGoals: {
              "dailyWaves10": { // goalId
                "progress": 7,
                "completed": false,
                "lastReset": Timestamp // Tracks when this daily goal was last reset/started
              },
              "weeklyHours3": { // goalId
                "progress": 5400, // e.g., seconds surfed this week
                "completed": false,
                "lastReset": Timestamp // Tracks start of the current week for this goal
              },
              "lifetimeSessions50": { // goalId
                 "progress": 36,
                 "completed": false
                 // No lastReset needed for lifetime
              }
            }
            ```
    *   `completedLifetimeGoals`: (Array - Optional) Store IDs of lifetime goals already achieved, to avoid reprocessing them.

*   **`goals` Collection:** A separate top-level collection to define all possible goals. This makes it easy to add/modify goals later without changing user data structures.
    *   **`goals/{goalId}` Document:**
        *   `goalId`: (String) Unique identifier (e.g., "dailyWaves10", "weeklyHours3", "lifetimeTopSpeed30").
        *   `description`: (String) User-facing text (e.g., "Ride 10 waves today", "Surf 3 hours this week").
        *   `type`: (String) "daily", "weekly", "lifetime".
        *   `metric`: (String) What data point triggers progress? (e.g., "waves", "sessionDuration", "totalDistance", "topSpeed", "sessions").
        *   `target`: (Number) The value needed to complete the goal (e.g., 10, 10800 (seconds), 30 (mph)).
        *   `xpReward`: (Number) XP awarded upon completion.
        *   `rankRequirement`: (Number - Optional) Minimum rank needed to receive this goal.
        *   `active`: (Boolean) Whether this goal is currently available to be assigned.

*   **`ranks` Collection (Optional but recommended):** Defines the ranking system.
    *   **`ranks/{rankLevel}` Document:**
        *   `rankLevel`: (Number) e.g., 1, 2, 3...
        *   `name`: (String) e.g., "Beginner", "Intermediate", "Shredder".
        *   `xpThreshold`: (Number) Minimum XP required to reach this rank (e.g., 0, 100, 500).
        *   `rewards`: (Array/Object - Optional) Details about rewards unlocked at this rank.

**2. Logic Execution (Cloud Functions Recommended)**

While some simple checks could happen client-side, using **Firebase Cloud Functions** is highly recommended for most of this logic for reliability, scalability, and security.

*   **A. Tracking Progress (Cloud Function):**
    *   **Trigger:** `onWrite` or `onCreate` for the `sessions` collection (or ideally, after your local analysis, when you write the final *summary* of a session to Firestore).
    *   **Action:**
        1.  Get the `userId` from the session data.
        2.  Read the user's `userProfiles/{userId}` document, specifically the `activeGoals`.
        3.  For each active goal, check if its `metric` matches the data in the newly written session (e.g., if `metric` is "waves", add `session.waveCount` to the goal's `progress`). Handle different metrics appropriately (duration, max speed from waves subcollection if needed - careful with reads!).
        4.  Update the `progress` for relevant goals within the `activeGoals` map in the user's profile document (use a Firestore transaction for safety).

*   **B. Checking Completion & Awarding XP (Cloud Function):**
    *   **Trigger:** Can be part of the same function as (A), running *after* progress is updated.
    *   **Action:**
        1.  After updating progress for a goal, check: `if (goal.progress >= goal.target && !goal.completed)`.
        2.  If true:
            *   Mark the goal as `completed: true` in `userProfiles/{userId}/activeGoals`.
            *   Read the corresponding `goal` document from the `goals` collection to get the `xpReward`.
            *   Increment the `xp` field in the `userProfiles/{userId}` document by `xpReward` (using `FieldValue.increment()`).
            *   For lifetime goals, you might also add the `goalId` to the `completedLifetimeGoals` array.

*   **C. Ranking Up (Cloud Function):**
    *   **Trigger:** Part of the same function as (B), running *after* XP might have been incremented.
    *   **Action:**
        1.  Read the user's current `rank` and new `xp` total.
        2.  Fetch the rank definitions from the `ranks` collection (or use hardcoded thresholds).
        3.  Check if the user's `xp` meets or exceeds the `xpThreshold` for the *next* rank level.
        4.  If true: Update the `rank` field in the `userProfiles/{userId}` document to the new rank level. (You might trigger other actions here later, like notifications or unlocking rewards).

*   **D. Goal Resets & Generation (Scheduled Cloud Function):**
    *   **Trigger:** Use Cloud Scheduler to run a function automatically (e.g., daily at midnight UTC, weekly on Monday midnight UTC).
    *   **Action (Reset):**
        1.  Query all `userProfiles` documents.
        2.  For each user, iterate through their `activeGoals`.
        3.  If a goal `type` is "daily" and its `lastReset` timestamp is older than the start of the current day (UTC), reset its `progress` to 0, `completed` to false, and update `lastReset` to the current time.
        4.  Do the same for "weekly" goals based on the start of the current week.
    *   **Action (Generate - can be combined with Reset):**
        1.  Determine which *new* daily/weekly goals the user should receive for the upcoming period (based on the `goals` collection, `active` status, and potentially `rankRequirement`).
        2.  Add these new goals (with `progress: 0`, `completed: false`, `lastReset: now`) to the user's `activeGoals` map. Be careful not to overwrite existing lifetime goals or weekly goals that haven't reset yet.

**3. Client-Side (App UI)**

*   **Displaying Goals:** Fetch data from `userProfiles/{userId}/activeGoals`. You'll likely also need to fetch the corresponding goal definitions from the `goals` collection (using the `goalId`s from `activeGoals`) to get descriptions, targets, etc. Display progress bars, text, checkmarks.
*   **Displaying Rank/XP:** Fetch `rank` and `xp` from `userProfiles/{userId}`. You might need the `ranks` collection data to show the rank name and progress towards the next rank. Display this in the `ProfileScreen` or `TopBar`.
*   **Real-time Updates:** Use Firestore's `onSnapshot` listener on the `userProfiles/{userId}` document. When the Cloud Functions update XP, rank, or goal progress/completion, the UI will automatically refresh to show the latest status.

This server-centric approach using Cloud Functions makes the system robust, prevents cheating, handles time-based resets reliably, and keeps the client app focused on displaying data rather than complex, potentially heavy calculations.
