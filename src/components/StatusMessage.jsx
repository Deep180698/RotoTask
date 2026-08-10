function StatusMessage({ message }) {

    if (!message) {
        return null;
    }

    return (

        <p className="statusMessage">
            {message}
        </p>

    );

}

export default StatusMessage;