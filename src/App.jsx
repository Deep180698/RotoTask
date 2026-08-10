import Warehouse from "./Warehouse";
import Inspector from "./Inspector";

import "./App.css";


function App() {

    const path =
        window.location.pathname;


    // ========================================
    // INSPECTOR PAGE
    // ========================================

    if (path === "/inspector") {

        return <Inspector />;

    }


    // ========================================
    // WAREHOUSE PAGE
    // ========================================

    return <Warehouse />;

}

export default App;