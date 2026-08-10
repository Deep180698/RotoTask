function BarcodeScanner({
    barcode,
    setBarcode,
    onKeyDown
}) {

    return (

        <div className="scannerContainer">

            <input

                className="barcodeInput"

                type="text"

                value={barcode}

                onChange={(e) =>
                    setBarcode(
                        e.target.value
                    )
                }

                onKeyDown={onKeyDown}

                placeholder="Scan barcode"

                autoFocus

            />

        </div>

    );

}

export default BarcodeScanner;