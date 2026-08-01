function BarcodeScanner({
    barcode,
    setBarcode
}){


    return (

        <input

            value={barcode}

            onChange={(e)=>setBarcode(e.target.value)}

            placeholder="Scan barcode"

        />

    );

}


export default BarcodeScanner;