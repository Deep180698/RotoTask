const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = 5000;
const HOST = "0.0.0.0";

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors());

app.use(express.json());

// ========================================
// DATA FILE
// ========================================

const dataDirectory = path.join(__dirname, "data");
const dataFile = path.join(dataDirectory, "notifications.json");

if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
}

if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(
        dataFile,
        JSON.stringify([], null, 2)
    );
}

// ========================================
// READ NOTIFICATIONS
// ========================================

function readNotifications() {
    try {
        const data = fs.readFileSync(
            dataFile,
            "utf8"
        );

        return JSON.parse(data);

    } catch (error) {

        console.error(
            "Error reading notifications:",
            error
        );

        return [];
    }
}

// ========================================
// SAVE NOTIFICATIONS
// ========================================

function saveNotifications(notifications) {

    fs.writeFileSync(
        dataFile,
        JSON.stringify(
            notifications,
            null,
            2
        )
    );
}

// ========================================
// TEST ROUTE
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

    try {

        const notifications =
            readNotifications();

        res.json(notifications);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Could not load notifications"
        });

    }

});

// ========================================
// SEND ORDER TO INSPECTOR
// ========================================

app.post("/send-notification", (req, res) => {

    try {

        const order =
            req.body.order;

        if (!order || !String(order).trim()) {

            return res.status(400).json({
                error: "Order number is required"
            });

        }

        const notifications =
            readNotifications();

        const newNotification = {

            id:
                Date.now().toString(),

            order:
                String(order).trim(),

            createdAt:
                new Date().toISOString()

        };

        notifications.push(
            newNotification
        );

        saveNotifications(
            notifications
        );

        console.log(
            "🔔 New order:",
            newNotification.order
        );

        res.status(201).json({

            success: true,

            message:
                "Order sent to inspector",

            notification:
                newNotification

        });

    } catch (error) {

        console.error(
            "Send notification error:",
            error
        );

        res.status(500).json({
            error: "Could not send notification"
        });

    }

});

// ========================================
// DELETE / MARK AS CHECKED
// ========================================

app.delete(
    "/notifications/:id",
    (req, res) => {

        try {

            const id =
                String(req.params.id);

            const notifications =
                readNotifications();

            const originalLength =
                notifications.length;

            const remaining =
                notifications.filter(
                    notification =>
                        String(notification.id) !== id
                );

            if (
                remaining.length ===
                originalLength
            ) {

                return res.status(404).json({
                    error: "Notification not found"
                });

            }

            saveNotifications(
                remaining
            );

            console.log(
                "✅ Order checked:",
                id
            );

            res.json({

                success: true,

                message:
                    "Order marked as checked"

            });

        } catch (error) {

            console.error(
                "Delete notification error:",
                error
            );

            res.status(500).json({
                error: "Could not delete notification"
            });

        }

    }
);

// ========================================
// START SERVER
// ========================================

app.listen(
    PORT,
    HOST,
    () => {

        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "🚀 RotoTask Backend Running"
        );
        console.log(
            "========================================"
        );
        console.log(
            `Port: ${PORT}`
        );
        console.log(
            `Host: ${HOST}`
        );
        console.log(
            "Network access enabled"
        );
        console.log(
            "========================================"
        );
        console.log("");

    }
);