import { useEffect, useRef, useState } from "react";

import {
    getNotifications,
    deleteNotification
} from "./services/api";

import "./App.css";


function Inspector() {

    const [orders, setOrders] = useState([]);

    const [error, setError] = useState("");

    const [showNotification, setShowNotification] =
        useState(false);

    const [newOrder, setNewOrder] = useState(null);

    const previousOrderIds = useRef(new Set());

    const firstLoad = useRef(true);

    const audioContext = useRef(null);


    // ========================================
    // REQUEST BROWSER NOTIFICATION PERMISSION
    // ========================================

    useEffect(() => {

        if ("Notification" in window) {

            if (Notification.permission === "default") {

                Notification.requestPermission()
                    .then(permission => {

                        console.log(
                            "Notification permission:",
                            permission
                        );

                    })
                    .catch(error => {

                        console.log(
                            "Notification permission error:",
                            error
                        );

                    });

            }

        } else {

            console.log(
                "This browser does not support notifications."
            );

        }

    }, []);


    // ========================================
    // PLAY NOTIFICATION SOUND
    // ========================================

    const playNotificationSound = () => {

        try {

            if (!audioContext.current) {

                const AudioContext =
                    window.AudioContext ||
                    window.webkitAudioContext;

                if (!AudioContext) {

                    return;

                }

                audioContext.current =
                    new AudioContext();

            }


            const context =
                audioContext.current;


            if (context.state === "suspended") {

                context.resume();

            }


            const oscillator =
                context.createOscillator();

            const gain =
                context.createGain();


            oscillator.connect(gain);

            gain.connect(
                context.destination
            );


            oscillator.type = "sine";

            oscillator.frequency.setValueAtTime(
                800,
                context.currentTime
            );


            oscillator.frequency.setValueAtTime(
                1000,
                context.currentTime + 0.2
            );


            gain.gain.setValueAtTime(
                0.5,
                context.currentTime
            );


            gain.gain.exponentialRampToValueAtTime(
                0.01,
                context.currentTime + 1
            );


            oscillator.start();

            oscillator.stop(
                context.currentTime + 1
            );

        }

        catch (error) {

            console.log(
                "Could not play notification sound:",
                error
            );

        }

    };


    // ========================================
    // SHOW WINDOWS / CHROME NOTIFICATION
    // ========================================

    const showBrowserNotification = (order) => {

        if (!("Notification" in window)) {

            console.log(
                "Browser notifications are not supported."
            );

            return;

        }


        if (Notification.permission !== "granted") {

            console.log(
                "Browser notification permission is not granted."
            );

            return;

        }


        try {

            const notification =
                new Notification(
                    "🔔 RotoTask - New Order",
                    {
                        body:
                            `Order ${order.order} is ready for inspection.`,

                        tag:
                            `rototask-order-${order.id}`,

                        requireInteraction:
                            true
                    }
                );


            notification.onclick = () => {

                window.focus();

                notification.close();

                setShowNotification(true);

            };

        }

        catch (error) {

            console.log(
                "Could not create browser notification:",
                error
            );

        }

    };


    // ========================================
    // LOAD ORDERS
    // ========================================

    const loadOrders = async () => {

        try {

            const data =
                await getNotifications();


            setOrders(data);

            setError("");


            const currentIds =
                new Set(
                    data.map(
                        order => order.id
                    )
                );


            // ====================================
            // FIRST PAGE LOAD
            // ====================================

            if (firstLoad.current) {

                previousOrderIds.current =
                    currentIds;

                firstLoad.current = false;

                return;

            }


            // ====================================
            // FIND NEW ORDERS
            // ====================================

            const newlyAddedOrders =
                data.filter(
                    order =>
                        !previousOrderIds.current.has(
                            order.id
                        )
                );


            // ====================================
            // NEW ORDER FOUND
            // ====================================

            if (newlyAddedOrders.length > 0) {

                const latestOrder =
                    newlyAddedOrders[
                        newlyAddedOrders.length - 1
                    ];


                console.log(
                    "🔔 NEW ORDER:",
                    latestOrder.order
                );


                setNewOrder(
                    latestOrder
                );


                setShowNotification(
                    true
                );


                // Play sound

                playNotificationSound();


                // Windows / Chrome notification

                showBrowserNotification(
                    latestOrder
                );

            }


            previousOrderIds.current =
                currentIds;

        }

        catch (error) {

            console.error(
                "Inspector connection error:",
                error
            );


            setError(
                "❌ Cannot connect to server"
            );

        }

    };


    // ========================================
    // CHECK SERVER EVERY 2 SECONDS
    // ========================================

    useEffect(() => {

        loadOrders();


        const interval =
            setInterval(
                loadOrders,
                2000
            );


        return () => {

            clearInterval(interval);

        };

    }, []);


    // ========================================
    // MARK ORDER AS CHECKED
    // ========================================

    const handleChecked = async (id) => {

        try {

            await deleteNotification(id);


            setOrders(
                previousOrders =>
                    previousOrders.filter(
                        order =>
                            order.id !== id
                    )
            );


            if (
                newOrder &&
                newOrder.id === id
            ) {

                setNewOrder(null);

                setShowNotification(false);

            }

        }

        catch (error) {

            console.error(
                "Could not check order:",
                error
            );


            alert(
                "Could not mark order as checked."
            );

        }

    };


    // ========================================
    // CLOSE POPUP
    // ========================================

    const closeNotification = () => {

        setShowNotification(false);

    };


    // ========================================
    // OPEN ORDER FROM POPUP
    // ========================================

    const openOrder = () => {

        setShowNotification(false);


        setTimeout(() => {

            const element =
                document.getElementById(
                    `order-${newOrder?.id}`
                );


            if (element) {

                element.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

            }

        }, 100);

    };


    return (

        <div className="inspectorPage">


            {/* ==================================
                NEW ORDER POPUP
            ================================== */}

            {showNotification &&
                newOrder && (

                <div
                    className="notificationOverlay"
                >

                    <div
                        className="notificationPopup"
                    >


                        <div
                            className="notificationBell"
                        >

                            🔔

                        </div>


                        <h1>
                            NEW ORDER
                        </h1>


                        <p>

                            A new order is ready
                            for inspection.

                        </p>


                        <div
                            className="popupOrder"
                        >

                            {newOrder.order}

                        </div>


                        <div
                            className="popupButtons"
                        >


                            <button
                                className="openOrderButton"
                                onClick={openOrder}
                            >

                                OPEN ORDER

                            </button>


                            <button
                                className="dismissButton"
                                onClick={
                                    closeNotification
                                }
                            >

                                DISMISS

                            </button>


                        </div>

                    </div>

                </div>

            )}


            {/* ==================================
                HEADER
            ================================== */}

            <div
                className="inspectorHeader"
            >

                <div>

                    <h1>
                        RotoTask
                    </h1>

                    <h2>
                        Inspector
                    </h2>

                </div>


                <div className="live">

                    ● LIVE

                </div>

            </div>


            {/* ==================================
                ORDERS
            ================================== */}

            <div
                className="ordersContainer"
            >


                {error && (

                    <div className="errorBox">

                        {error}

                    </div>

                )}


                <div className="ordersHeader">


                    <h2 className="ordersTitle">

                        🔔 Orders Ready to Check

                    </h2>


                    <div className="orderCounter">

                        {orders.length}

                    </div>


                </div>


                {/* ==================================
                    NO ORDERS
                ================================== */}

                {orders.length === 0 &&
                    !error && (

                    <div className="noOrders">


                        <div className="checkIcon">

                            ✓

                        </div>


                        <h2>

                            No orders waiting

                        </h2>


                        <p>

                            New orders will appear
                            automatically.

                        </p>


                    </div>

                )}


                {/* ==================================
                    ORDER LIST
                ================================== */}

                {orders.map(order => (

                    <div
                        className="orderCard"
                        id={`order-${order.id}`}
                        key={order.id}
                    >


                        <div
                            className="orderInfo"
                        >


                            <div
                                className="orderLabel"
                            >

                                ORDER

                            </div>


                            <div
                                className="orderNumber"
                            >

                                {order.order}

                            </div>


                            <div
                                className="orderStatus"
                            >

                                🔔 Ready to Check

                            </div>


                            <div
                                className="orderTime"
                            >

                                Received:

                                {" "}

                                {new Date(
                                    order.createdAt
                                ).toLocaleString()}

                            </div>


                        </div>


                        <button
                            className="checkedButton"
                            onClick={() =>
                                handleChecked(
                                    order.id
                                )
                            }
                        >

                            ✓ CHECKED

                        </button>


                    </div>

                ))}

            </div>

        </div>

    );

}


export default Inspector;