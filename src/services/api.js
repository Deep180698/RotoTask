const API_URL = "http://localhost:5000";


export async function sendOrderEmail(order) {


    const response = await fetch(
        `${API_URL}/send-email`,
        {
            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({
                order
            })
        }
    );


    if(!response.ok){

        throw new Error(
            "Email sending failed"
        );

    }


    return response.json();

}