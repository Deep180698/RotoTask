import { useState } from "react";
import Header from "./components/Header";
import BarcodeScanner from "./components/BarcodeScanner";
import StatusMessage from "./components/StatusMessage";
import { sendOrderEmail } from "./services/api";
import "./App.css";


function App() {

  const [barcode, setBarcode] = useState("");
  const [message, setMessage] = useState("");


  const handleSendOrder = async () => {

    if (!barcode) {

      setMessage("Please scan barcode first");
      return;

    }


    try {

      setMessage("Sending email...");


      const result = await sendOrderEmail(barcode);


      console.log(result);


      setMessage(
        `✅ Order ${barcode} sent successfully`
      );


    } catch (error) {

      console.log(error);

      setMessage(
        "❌ Failed to send email"
      );

    }

  };


  return (

    <div className="container">

      <div className="body">
        <Header />
        <BarcodeScanner
          barcode={barcode}
          setBarcode={setBarcode}
        />
      </div>
      <button className="buttonStyle" onClick={handleSendOrder}>
        Send Order
      </button>
      <StatusMessage message={message} />

    </div>

  );

}


export default App;