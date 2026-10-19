
const express = require("express");
const cors = require("cors");

const app = express();


// ========================================
// CONFIGURATION
// ========================================

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";


// ========================================
// MIDDLEWARE
// ========================================

app.use(
    cors({
        origin: "*"
    })
);

app.use(express.json());


// ========================================
// TEMPORARY NOTIFICATION STORAGE
// ========================================

let notifications = [];


// ========================================
// HOME / HEALTH CHECK
// ========================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "🚀 RotoTask Backend Running",
        port: PORT
    });

});


// ========================================
// GET NOTIFICATIONS
// ========================================

app.get("/notifications", (req, res) => {

    res.json(notifications);

});


// ========================================
// SEND NOTIFICATION
// ========================================

app.post("/send-notification", (req, res) => {

    try {

        const { order } = req.body;


        if (!order) {

            return res.status(400).json({
                success: false,
                message: "Order is required"
            });

        }


        const notification = {

            id:
                Date.now().toString(),

            order:
                order,

            createdAt:
                new Date().toISOString()

        };


        notifications.push(
            notification
        );


        console.log(
            "🔔 New order:",
            notification
        );


        res.json({

            success: true,

            message:
                "Order sent to inspector",

            notification:
                notification

        });

    }

    catch (error) {

        console.error(
            "Send notification error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Server error"

        });

    }

});


// ========================================
// DELETE NOTIFICATION
// ========================================

app.delete(
    "/notifications/:id",
    (req, res) => {

        const { id } =
            req.params;


        const before =
            notifications.length;


        notifications =
            notifications.filter(
                notification =>
                    notification.id !== id
            );


        if (
            notifications.length === before
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Notification not found"

            });

        }


        res.json({

            success: true,

            message:
                "Notification deleted"

        });

    }
);


// ========================================
// 404 HANDLER
// ========================================

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message:
            "Route not found",

        path:
            req.originalUrl

    });

});


// ========================================
// START SERVER
// ========================================

app.listen(
    PORT,
    HOST,
    () => {

        console.log(
            `🚀 RotoTask Backend Running on ${HOST}:${PORT}`
        );

    }
);

