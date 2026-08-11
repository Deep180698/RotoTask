import Warehouse from "./Warehouse";
import Inspector from "./Inspector";

import "./App.css";

function App() {

    const params = new URLSearchParams(
        window.location.search
    );

    const screen = params.get("screen");

    console.log("RotoTask screen:", screen);

    if (screen === "inspector") {
        return <Inspector />;
    }

    return <Warehouse />;
}

export default App;