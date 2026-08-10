import { useState } from "react";

import Header from "./components/Header";
import BarcodeScanner from "./components/BarcodeScanner";
import StatusMessage from "./components/StatusMessage";

import { sendOrderNotification } from "./services/api";

function Warehouse() {

    const [barcode, setBarcode] = useState("");

    const [message, setMessage] = useState("");

    const [sending, setSending] = useState(false);


    // ========================================
    // SEND ORDER
    // ========================================

    const handleSendOrder = async () => {

        if (!barcode.trim()) {

            setMessage(
                "⚠️ Please scan barcode first"
            );

            return;
        }

        try {

            setSending(true);

            setMessage(
                "⏳ Sending to inspector..."
            );

            const result =
                await sendOrderNotification(
                    barcode
                );

            console.log(result);

            setMessage(
                `✅ Order ${barcode} sent to inspector`
            );

            setBarcode("");

        }

        catch (error) {

            console.error(error);

            setMessage(
                "❌ Could not connect to server"
            );

        }

        finally {

            setSending(false);

        }

    };


    // ========================================
    // ENTER KEY
    // ========================================

    const handleKeyDown = (event) => {

        if (
            event.key === "Enter" &&
            !sending
        ) {

            handleSendOrder();

        }

    };


    return (

        <div className="page">

            <div className="card">

                <Header />

                <h2>
                    Warehouse
                </h2>

                <p className="instruction">
                    Scan the order barcode
                </p>

                <BarcodeScanner

                    barcode={barcode}

                    setBarcode={setBarcode}

                    onKeyDown={handleKeyDown}

                />

                <button

                    className="buttonStyle"

                    onClick={handleSendOrder}

                    disabled={sending}

                >

                    {sending
                        ? "Sending..."
                        : "SEND TO INSPECTOR"
                    }

                </button>

                <StatusMessage
                    message={message}
                />

            </div>

        </div>

    );

}

export default Warehouse;