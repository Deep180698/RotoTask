const API_URL =
    import.meta.env.API_URL ||
    `${window.location.protocol}//${window.location.hostname.replace(
        "-5173",
        "-5000"
    )}`;

console.log("RotoTask API:", API_URL);

// ========================================
// SEND ORDER NOTIFICATION
// ========================================

export async function sendOrderNotification(order) {

    const response = await fetch(
        `${API_URL}/send-notification`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                order: order,
            }),
        }
    );

    if (!response.ok) {
        throw new Error(
            `Server error: ${response.status}`
        );
    }

    return response.json();
}


// ========================================
// GET NOTIFICATIONS
// ========================================

export async function getNotifications() {

    const response = await fetch(
        `${API_URL}/notifications`
    );

    if (!response.ok) {
        throw new Error(
            `Server error: ${response.status}`
        );
    }

    return response.json();
}


// ========================================
// DELETE NOTIFICATION
// ========================================

export async function deleteNotification(id) {

    const response = await fetch(
        `${API_URL}/notifications/${id}`,
        {
            method: "DELETE",
        }
    );

    if (!response.ok) {
        throw new Error(
            `Server error: ${response.status}`
        );
    }

    return response.json();
}

