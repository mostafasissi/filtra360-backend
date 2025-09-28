const cronService = require("../services/cron.service");
const catchAsyncHandler = require("../utils/catchAsyncHandler");

class CronController {
  /**
   * Get cron service status
   */
  static getStatus = catchAsyncHandler(async (req, res) => {
    const status = cronService.getStatus();
    return res.status(200).json({
      success: true,
      message: "Cron service status retrieved successfully",
      data: status
    });
  });

  /**
   * Manually trigger sync
   */
  static manualSync = catchAsyncHandler(async (req, res) => {
    await cronService.manualSync();
    return res.status(200).json({
      success: true,
      message: "Manual sync triggered successfully"
    });
  });

  /**
   * Get next run time
   */
  static getNextRun = catchAsyncHandler(async (req, res) => {
    const nextRun = cronService.getNextRunTime();
    return res.status(200).json({
      success: true,
      message: "Next run time retrieved successfully",
      data: { nextRun }
    });
  });
}

module.exports = CronController; 