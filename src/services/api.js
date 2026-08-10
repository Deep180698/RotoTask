const API_URL =
    "https://cautious-lamp-v66r4rjg7vprcp4j5-5000.app.github.dev";

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