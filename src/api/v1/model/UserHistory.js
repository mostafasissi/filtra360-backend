const mongoose = require("mongoose");

/**
 * UserHistory Schema
 * Stores historical snapshots of user profile data for tracking changes over time
 */
const userHistorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User ID is required"],
            index: true
        },
        snapshotDate: {
            type: Date,
            required: [true, "Snapshot date is required"],
            default: Date.now
        },
        isProfileComplete: {
            type: Boolean,
            default: false
        },
        step: {
            type: Number,
            default: 1,
        },
        // Basic profile info
        dateOfBirth: {
            type: Date,
            validate: {
                validator: function (v) {
                    return v <= new Date();
                },
                message: "Date of birth cannot be in the future"
            }
        },
        sexAtBirth: {
            type: String,
            enum: {
                values: ["Male", "Female", "Other"],
                message: "{VALUE} is not a valid sex at birth"
            }
        },
        height: {
            type: Number,
            min: [0, "Height cannot be negative"],
            max: [300, "Height seems unrealistic"]
        },
        heightUnit: {
            type: String,
            enum: ["cm", "in"],
            default: "cm"
        },
        weight: {
            type: Number,
            min: [0, "Weight cannot be negative"],
            max: [500, "Weight seems unrealistic"]
        },
        weightUnit: {
            type: String,
            enum: ["kg", "lbs"],
            default: "kg"
        },
        location: {
            type: String,
            trim: true,
            maxLength: [100, "Location name cannot be more than 100 characters"]
        },

        // Body measurements (in centimeters or inches)
        waistCircumference: {
            type: Number,
            min: [0, "Waist circumference cannot be negative"],
            max: [200, "Waist circumference seems unrealistic"]
        },
        chestCircumference: {
            type: Number,
            min: [0, "Chest circumference cannot be negative"],
            max: [200, "Chest circumference seems unrealistic"]
        },
        armCircumference: {
            type: Number,
            min: [0, "Arm circumference cannot be negative"],
            max: [100, "Arm circumference seems unrealistic"]
        },
        circumferenceUnit: {
            type: String,
            enum: ["cm", "in"],
            default: "cm"
        },

        // Lifestyle
        dietType: {
            type: String,
            enum: {
                values: [
                    "Omnivore",
                    "Vegetarian",
                    "Vegan",
                    "Pescatarian",
                    "Paleo",
                    "Keto",
                    "Low-Carb",
                    "Mediterranean",
                    "Carnivore",
                    "Flexitarian",
                    "Gluten-Free",
                    "Dairy-Free",
                    "Custom/Other"
                ],
                message: "{VALUE} is not a valid diet type"
            }
        },
        exerciseLevel: {
            type: String,
            enum: {
                values: ["Sedentary", "Moderate", "Active"],
                message: "{VALUE} is not a valid exercise level"
            }
        },
        sleepQuality: {
            type: String,
            enum: {
                values: ["Poor", "Medium", "Good"],
                message: "{VALUE} is not a valid sleep quality rating"
            }
        },
        smokes: {
            type: Boolean,
            default: false
        },
        drinksAlcohol: {
            type: String,
            enum: {
                values: ["Never", "Occasionally", "Regularly"],
                message: "{VALUE} is not a valid alcohol consumption frequency"
            }
        },

        // Symptoms & goals
        symptoms: [{
            type: String,
            trim: true
        }],
        goals: [{
            type: String,
            trim: true
        }],

        // Optional uploads
        uploads: [{
            type: {
                type: String,
                enum: {
                    values: ["DNA", "Blood Work", "Supplements"],
                    message: "{VALUE} is not a valid upload type"
                },
                required: [true, "Upload type is required"]
            },
            fileUrl: {
                type: String,
                required: [true, "File URL is required"],
                trim: true
            },
            uploadedAt: {
                type: Date,
                default: Date.now
            }
        }],

        // DNA Analysis Data
        dnaAnalysis: {
            markers: [{
                rs_number: {
                    type: String,
                    required: true,
                    trim: true
                },
                value: {
                    type: String,
                    required: true,
                    trim: true
                },
                notes: {
                    type: String,
                    trim: true
                }
            }],
            metadata: {
                total_markers_found: Number,
                analysis_date: Date,
                last_updated: {
                    type: Date,
                    default: Date.now
                }
            }
        },

        // Blood Report Data
        bloodReport: {
            patient_info: {
                name: String,
                id: String,
                date: Date
            },
            results: {
                cbc: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }],
                chemistry: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }],
                lipids: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }],
                hormones: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }],
                vitamins: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }],
                other: [{
                    test_name: String,
                    value: String,
                    unit: String,
                    reference_range: String,
                    status: String
                }]
            },
            metadata: {
                total_tests: Number,
                report_date: Date,
                lab_name: String,
                last_updated: {
                    type: Date,
                    default: Date.now
                }
            }
        },

        // Supplements & Medications
        supplementsAndMedications: [{
            name: { type: String, required: true, trim: true },
            brand: { type: String, trim: true },
            form: { type: String, trim: true }, // e.g., Capsule, Tablet, etc.
            dosage: { type: String, trim: true },
            frequency: { type: String, trim: true },
            timing: { type: String, trim: true },
            purpose: { type: String, trim: true }
        }],

        dailyLogs: [{
            date: { type: Date, required: true },
            symptoms: [{
                name: String,
                severity: Number, // e.g., 1-10
                note: String,
                contextTags: [String]
            }],
            weight: {
                value: Number,
                unit: { type: String, default: "kg" }
            },
            note: {
                text: String,
                tags: [String],
                digestionMood: Number // e.g., 1-5 scale
            }
        }],

        dashboardInsight: {
            result: { type: Object }, // Store the dashboard summary/result
            lastAnalyzedAt: { type: Date }
        },

        // Additional fields for history tracking
        wellnessScore: {
            type: Number,
            min: [0, "Wellness score cannot be negative"],
            max: [100, "Wellness score cannot exceed 100"]
        },
        dataSource: {
            type: String,
            enum: ["Manual", "Auto", "Scheduled"],
            default: "Auto"
        },
        changeReason: {
            type: String,
            trim: true,
            maxLength: [200, "Change reason cannot be more than 200 characters"]
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Index for faster queries
userHistorySchema.index({ userId: 1, snapshotDate: -1 });

// Virtual for BMI calculation
userHistorySchema.virtual('bmi').get(function () {
    if (this.height && this.weight) {
        // Convert height from cm to m and calculate BMI
        const heightInMeters = this.height / 100;
        return (this.weight / (heightInMeters * heightInMeters)).toFixed(2);
    }
    return null;
});

// Pre-save middleware to ensure data consistency
userHistorySchema.pre('save', function (next) {
    // Trim all string fields
    for (let key in this._doc) {
        if (typeof this[key] === 'string') {
            this[key] = this[key].trim();
        }
    }
    next();
});

module.exports = mongoose.model("UserHistory", userHistorySchema); 