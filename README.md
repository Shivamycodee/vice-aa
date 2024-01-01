## Installation

npm install vice-aa


## Usage

This package provides four main functions:

- `getUserOperation`
- `getSignedUserOp`
- `CustomJsonRpcProvider`
- `waitForReceipt`

Follow the steps below to use these functions in your project.

### Step 1: Create a Provider and Contract Instance

First, set up your provider and create an instance of the contract with which you wish to interact.

```javascript
import { ethers } from "ethers";
import { YourContractAddress, YourContractABI } from "<your-contract-data-location>";

const provider = new ethers.providers.Web3Provider(window.ethereum);
const contract = new ethers.Contract(YourContractAddress, YourContractABI, provider);
```


## Step 2: Populate Your Transaction

Next, populate the transaction you intend to execute.

```javascript
const populatedTx = await contract.populateTransaction.<YourContractMethod>(
  // Method parameters go here
);
```

## Step 3: Get User Operation

Use getUserOperation with your contract wallet address, contract address, populated transaction, paymaster URL, and your chosen RPC URL.

```javascript
import { getUserOperation } from "vice-aa";

const userOperation = await getUserOperation(
  yourContractWalletAddress,
  YourContractAddress,
  populatedTx,
  "https://<your-paymaster-url>",
  "<your-rpc-url>"
);
```

## Step 4: Get Signed User Operation


Then, call getSignedUserOp with the userOperation , paymaster URL, and a boolean to indicate the type of paymaster.

```javascript
import { getSignedUserOp } from "vice-aa";

const signedUserOp = await getSignedUserOp(
  userOperation,
  "https://<your-paymaster-url>",
  true // Set to false for ERC20 paymaster
);
```

## Step 5: Send User Operation

Create a custom provider and send the user operation.

```javascript
import { CustomJsonRpcProvider } from "vice-aa";

const customProvider = new CustomJsonRpcProvider("<your-rpc-url>");
const userOpHash = await customProvider.sendUserOperation(signedUserOp);
```

## Step 6: Wait for Transaction Receipt

Finally, wait for the transaction hash using waitForReceipt.

```javascript
import { waitForReceipt } from "vice-aa";
const txHash = await waitForReceipt(customProvider, userOpHash);
```

## Support

For additional support or queries, feel free to reach out or open an issue on the [vice-aa repository](https://github.com/Shivamycodee/vice-aa).