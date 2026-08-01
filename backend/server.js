require("dotenv").config({
    path: "./.env"
});

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();


// Middleware
app.use(cors({
    origin: [
        "https://rototask.onrender.com",
        "http://localhost:5173"
    ]
}));app.use(express.json());


// Check environment variables
console.log("========== ENV CHECK ==========");
console.log("EMAIL:", process.env.EMAIL);
console.log("RECEIVER:", process.env.RECEIVER);
console.log("PASSWORD LENGTH:", process.env.PASSWORD?.length);
console.log("==============================");



// Gmail transporter
const transporter = nodemailer.createTransport({

    host: "smtp.gmail.com",

    port: 465,

    secure: true,

    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }

});



// Verify Gmail connection

transporter.verify((error, success) => {

    if (error) {

        console.log("❌ Gmail Connection Failed");
        console.log(error);

    } else {

        console.log("✅ Gmail SMTP Connected Successfully");

    }

});




// Test route

app.get("/", (req, res) => {

    res.send("RotoTask Backend Running");

});




// Send email API

app.post("/send-email", async (req, res) => {
console.log("🔥 SEND EMAIL API CALLED");

    console.log("\n========== NEW ORDER ==========");

    console.log("Request Body:");
    console.log(req.body);



    const { order } = req.body;



    if (!order) {

        console.log("❌ Order number missing");


        return res.status(400).json({

            success: false,

            message: "Order number required"

        });

    }



    console.log("Order Number:", order);

    console.log("Sending email from:", process.env.EMAIL);

    console.log("Sending email to:", process.env.RECEIVER);



    try {


        const info = await transporter.sendMail({

            from: process.env.EMAIL,

            to: process.env.RECEIVER,

            subject: "RotoTask - Order Ready To Check",


            html: `

                <div style="font-family:Arial">

                    <h2>📦 RotoTask Notification</h2>

                    <p>Hello,</p>

                    <p>The following order is ready to check:</p>


                    <h1>${order}</h1>


                    <p>
                    Please verify the order.
                    </p>


                    <br>

                    <p>
                    RotoTask System
                    </p>

                </div>

            `

        });



        console.log("✅ Email Sent Successfully");

        console.log("Message ID:", info.messageId);

        console.log("Response:", info.response);


        console.log("==============================\n");



        res.json({

            success:true,

            message:"Email sent successfully",

            messageId:info.messageId

        });



    } catch(error) {


        console.log("❌ EMAIL SEND ERROR");

        console.log(error);


        console.log("==============================\n");



        res.status(500).json({

            success:false,

            message:error.message

        });


    }


});





// Start server

app.listen(5000, () => {

    console.log("");
    console.log("🚀 RotoTask Backend Running");
    console.log("PORT: 5000");
    console.log("");

});