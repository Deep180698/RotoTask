
import Warehouse from "./Warehouse";
import Inspector from "./Inspector";

import "./App.css";

function App() {
  const params = new URLSearchParams(window.location.search);
  const screen = params.get("screen");

  console.log("RotoTask screen:", screen);

  if (screen === "inspector") {
    return (
      <>
        <Inspector />

        <button
          onClick={() => {
            window.location.href = "/";
          }}
          style={{
            position: "fixed",
            top: "20px",
            left: "20px",
            padding: "10px 18px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          ← Back to Warehouse
        </button>
      </>
    );
  }

  return (
    <>
      <Warehouse />

      <button
        onClick={() => {
          window.location.href = "?screen=inspector";
        }}
        style={{
          position: "fixed",
          bottom: "30px",
          right: "30px",
          padding: "14px 24px",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
          fontSize: "18px",
          fontWeight: "bold",
        }}
      >
        🔍 Inspector
      </button>
    </>
  );
}

export default App;

