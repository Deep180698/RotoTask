const express = require("express");
const cors = require("cors");

const app = express();

const PORT = 5000;

// Allow React to connect
app.use(cors());

app.use(express.json());

// Store orders temporarily
let notifications = [];

// ========================================
// TEST SERVER
// ========================================

app.get("/", (req, res) => {
    res.send("RotoTask Backend Running");
});

// ========================================
// SEND ORDER TO INSPECTOR
// ========================================

app.post("/send-notification", (req, res) => {

    console.log("");
    console.log("================================");
    console.log("🔥 NEW ORDER");
    console.log("================================");

    const { order } = req.body;

    if (!order || !order.trim()) {

        return res.status(400).json({
            success: false,
            message: "Order number required"
        });

    }

    const notification = {

        id: Date.now(),

        order: order.trim(),

        message: "Order is ready to check",

        status: "READY",

        createdAt: new Date()

    };

    notifications.push(notification);

    console.log("📦 Order:", notification.order);

    console.log("🔔 Notification created");

    console.log("================================");
    console.log("");

    res.json({

        success: true,

        message: "Order sent to inspector",

        notification: notification

    });

});

// ========================================
// GET ORDERS
// ========================================

app.get("/notifications", (req, res) => {

    res.json(notifications);

});

// ========================================
// CHECK ORDER
// ========================================

app.delete("/notifications/:id", (req, res) => {

    const id = Number(req.params.id);

    const notificationExists =
        notifications.some(
            notification => notification.id === id
        );

    if (!notificationExists) {

        return res.status(404).json({

            success: false,

            message: "Notification not found"

        });

    }

    notifications = notifications.filter(

        notification =>
            notification.id !== id

    );

    console.log(
        "✅ Order checked. ID:",
        id
    );

    res.json({

        success: true,

        message: "Order checked"

    });

});

// ========================================
// START SERVER
// ========================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log("================================");
        console.log("🚀 RotoTask Backend Running");
        console.log("================================");
        console.log(`Port: ${PORT}`);
        console.log("Network access enabled");
        console.log("================================");
        console.log("");

    }
);