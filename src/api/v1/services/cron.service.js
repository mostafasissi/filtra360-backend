const cron = require('node-cron');
const UserProfile = require('../model/UserProfile');
const UserHistory = require('../model/UserHistory');

class CronService {
    constructor() {
        this.isRunning = false;
    }

    /**
     * Initialize cron jobs
     */
    init() {
        console.log('Initializing cron jobs...');
        
        // Run twice a day: at 9:00 AM and 9:00 PM UTC
        cron.schedule('0 9,21 * * *', () => {
            this.syncUserProfilesToHistory();
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        console.log('Cron jobs initialized successfully - running twice daily at 9:00 AM and 9:00 PM UTC');
    }

    /**
     * Sync UserProfile data to UserHistory table
     */
    async syncUserProfilesToHistory() {
        if (this.isRunning) {
            console.log('Sync job already running, skipping...');
            return;
        }

        this.isRunning = true;
        console.log('Starting UserProfile to UserHistory sync...');

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get all user profiles that have been updated today
            const updatedProfiles = await UserProfile.find({
                updatedAt: {
                    $gte: today
                }
            });

            console.log(`Found ${updatedProfiles.length} profiles updated today`);

            for (const profile of updatedProfiles) {
                try {
                    await this.createOrUpdateHistoryEntry(profile, today);
                } catch (error) {
                    console.error(`Error processing profile ${profile.userId}:`, error.message);
                }
            }

            console.log('UserProfile to UserHistory sync completed successfully');
        } catch (error) {
            console.error('Error in syncUserProfilesToHistory:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Create or update history entry for a user profile
     * Ensures only one document per user per day
     */
    async createOrUpdateHistoryEntry(profile, snapshotDate) {
        try {
            // Check if history entry already exists for today
            const existingHistory = await UserHistory.findOne({
                userId: profile.userId,
                snapshotDate: {
                    $gte: snapshotDate,
                    $lt: new Date(snapshotDate.getTime() + 24 * 60 * 60 * 1000) // Next day
                }
            });

            if (existingHistory) {
                // Delete existing history entry first
                console.log(`Deleting existing history entry for user ${profile.userId} for today`);
                await UserHistory.findByIdAndDelete(existingHistory._id);
            }

            // Create new history entry (ensures only one document per day)
            console.log(`Creating new history entry for user ${profile.userId}`);
            
            const profileData = profile.toObject();
            delete profileData._id; // Remove the original _id
            delete profileData.__v; // Remove version key

            const newHistory = new UserHistory({
                ...profileData,
                snapshotDate: new Date(),
                dataSource: "Scheduled",
                changeReason: existingHistory ? "Hourly sync - replaced existing entry" : "Hourly sync - new entry"
            });

            await newHistory.save();
            console.log(`Created new history entry for user ${profile.userId}`);
        } catch (error) {
            console.error(`Error creating/updating history for user ${profile.userId}:`, error);
            throw error;
        }
    }

    /**
     * Manual trigger for sync (for testing or immediate sync)
     */
    async manualSync() {
        console.log('Manual sync triggered...');
        await this.syncUserProfilesToHistory();
    }

    /**
     * Get sync status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            nextRun: this.getNextRunTime()
        };
    }

    /**
     * Get next run time
     */
    getNextRunTime() {
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        return nextHour;
    }
}

// Create singleton instance
const cronService = new CronService();

module.exports = cronService; 