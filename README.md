## Installation

```javascript
npm install vice-aa
```

## Supported Networks 

- [AMOY NETWORK](https://amoy.polygonscan.com/) 
- [MUMBAI NETWORK](https://mumbai.polygonscan.com/) (Depreciated.)
- [POLYGON NETWORK](https://polygonscan.com/) (Comming Soon...)
 
## Paymaster URL's

Simple Paymaster -> https://vice-aa-api.vercel.app/paymaster

ERC20 Token Paymaster -> https://vice-aa-api.vercel.app/tokenpaymaster


# ERC20 Token For TokenPaymaster

- Token Name: HYPER TOKEN 
- Token Address: [0x5c54b57557BAB28aC1C416063f657d8C89842896](https://amoy.polygonscan.com/token/0x5c54b57557BAB28aC1C416063f657d8C89842896)

You can get this token from [Uniswap](https://app.uniswap.org/swap)

> ⚠️ **WARNING:** MAKE SURE TO APPROVE THE [ERC20PAYMASTER](https://amoy.polygonscan.com/address/0x22bE1dca416b40dc67F1fD09Eaa49347E5b34720) CONTRACT FOR HYPER TOKEN TO USE ERC20PAYMASTER URL.


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

## Example 

- [Apporve A Contract for Token Transfer](https://gist.github.com/Shivamycodee/ea3364cf816863c62cdeb9e6d0b556d0)

## Support

For additional support or queries, feel free to reach out or open an issue on the [vice-aa repository](https://github.com/Shivamycodee/vice-aa).