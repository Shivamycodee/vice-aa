const paymasterCall = async (paymasterHash, PaymasterRPC_URL) => {
  try {

    console.log("paymasterHash: ", paymasterHash);
    console.log("PaymasterRPC_URL: ", PaymasterRPC_URL);

    const response = await fetch(PaymasterRPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymasterHash }),
    });

    if (!response.ok){
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.signature; // Assuming the response contains a 'signature' field
  } catch (error) {
    console.error("Error in PaymasterCall:", error);
    throw error; // Re-throw the error for handling it in the caller function
  }
};

const ERC20paymasterCall = async (paymasterHash, ERC20_PaymasterRPC_URL) => {
  console.log("Calling ERC20 Paymaster...");

  try {
    const response = await fetch(ERC20_PaymasterRPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymasterHash }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.signature; // Assuming the response contains a 'signature' field
  } catch (error) {
    console.error("Error in ERC20PaymasterCall:", error);
    throw error; // Re-throw the error for handling it in the caller function
  }
};



export { paymasterCall, ERC20paymasterCall };
