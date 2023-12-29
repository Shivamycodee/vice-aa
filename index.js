import { ethers } from "ethers";
import EntryPointABI from "./abi/EntryPoint.json";
import SimpleAccountABI from "./abi/SimpleAccount.json";
import VerifyingPaymasterABI from "./abi/VerifyingPaymaster.json";
import SimpleAccountFactoryABI from "./abi/SimpleAccountFactory.json";
import ERC20VerifyingPaymasterABI from "./abi/ERC20VerifyingPaymaster.json";
import {
  EntryPointAddress,
  OracleAggregator,
  MUMBAI_URL,
  SimpleAccountFactoryAddress,
  VerifyingPaymasterAddress,
  ERC20VerifierAddress,
  CoreTokenAddress,
} from "./data";
import { paymasterCall, ERC20paymasterCall } from "./api/paymasterHandler";


const getSCWallet = async (address) => {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const contract = new ethers.Contract(
    SimpleAccountFactoryAddress,
    SimpleAccountFactoryABI,
    provider
  );
  const wallet = await contract.createdAccounts(address, 0);
  return wallet;
};

const getCurrnetNonce = async (address) => {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const contract = new ethers.Contract(
    EntryPointAddress,
    EntryPointABI,
    provider
  );
  const nonce = await contract.getNonce(address, 0);
  return nonce;
};

const getUserOperation = async (SCWAddress, callContract, minTx) => {

  const provider = new ethers.providers.Web3Provider(window.ethereum);

  const simpleAccount = new ethers.Contract(
    SCWAddress,
    SimpleAccountABI,
    provider
  );

  const nonce = await getCurrnetNonce(SCWAddress);
  const finalNonce = ethers.utils.hexValue(nonce);

  const userOperation = {
    sender: SCWAddress,
    nonce: finalNonce,
    initCode: "0x",
    callData: simpleAccount.interface.encodeFunctionData("execute", [
      callContract,
      0,
      minTx.data,
    ]),
    callGasLimit: 112489,
    verificationGasLimit: 87538,
    preVerificationGas: 93636,
    maxFeePerGas: 100_000_000_000,
    maxPriorityFeePerGas: 100_000_000_000,
    paymasterAndData: "0x",
    signature: "0x",
  };

  if (SCWAddress == ethers.constants.AddressZero) {
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    const res = await getInitCode(address);

    // userOperation.initCode = res[0];
    userOperation.sender = res[1];
  }

  console.log("userOperation : ", userOperation);

  return userOperation;
};

function getTxTimeLimit() {
  const currentTime = Math.floor(Date.now() / 1000); // mili to sec
  const tenMinutesLater = currentTime;
  return [currentTime + 3600, tenMinutesLater];
}

async function getPaymasterAndData(userOperation) {

  const timeLimit = getTxTimeLimit();
  const signedPaymasterHash = await getSignedPaymasterHash(
      userOperation,
      timeLimit
    );

  const paymasterAndData = ethers.utils.concat([
    VerifyingPaymasterAddress,
    ethers.utils.defaultAbiCoder.encode(
      ["uint48", "uint48"],
      [timeLimit[0], timeLimit[1]]
    ),
    signedPaymasterHash,
  ]);

  paymasterAndData = ethers.utils.hexlify(paymasterAndData);
  userOperation.paymasterAndData = paymasterAndData;
  return userOperation;
}

async function getERC20PaymasterAndData(
  priceSource,
  userOperation,
  timeLimit,
  exchangeRate,
  priceMarkup
) {

  const paymasterSignature = await getSignedERC20PaymasterHash(userOperation);

  const priceSourceBytes = numberToHexString(priceSource);

  const paymasterAndData = ethers.utils.concat([
    ERC20VerifierAddress,
    priceSourceBytes,
    ethers.utils.defaultAbiCoder.encode(
      ["uint48", "uint48", "address", "address", "uint256", "uint32"],
      [
        timeLimit[0],
        timeLimit[1],
        CoreTokenAddress,
        OracleAggregator,
        exchangeRate,
        priceMarkup,
      ]
    ),
    paymasterSignature,
  ]);

  paymasterAndData = ethers.utils.hexlify(paymasterAndData);
  return paymasterAndData;
}

function numberToHexString(number) {
  if (number < 0) {
    throw new Error("Number must be positive");
  }
  let hexString = number.toString(16);
  // Ensure even number of characters (pad with a leading zero if necessary)
  if (hexString.length % 2 !== 0) {
    hexString = "0" + hexString;
  }
  return "0x" + hexString;
}

const getSignedPaymasterHash = async (userOp) => {
  const provider = new ethers.providers.JsonRpcProvider(MUMBAI_URL);

  const paymasterContract = new ethers.Contract(
    VerifyingPaymasterAddress,
    VerifyingPaymasterABI,
    provider
  );

  const timeLimit = getTxTimeLimit();

  const paymasterHash = await paymasterContract.getHash(
    userOp,
    timeLimit[0],
    timeLimit[1]
  );

  const paymasterSignature = await paymasterCall(paymasterHash);

  console.log("paymasterSignature : ", paymasterSignature);

  return paymasterSignature;
};

const getSignedERC20PaymasterHash = async (userOp) => {

  const provider = new ethers.providers.JsonRpcProvider(MUMBAI_URL);

  const paymasterContract = new ethers.Contract(
    ERC20VerifierAddress,
    ERC20VerifyingPaymasterABI,
    provider
  );

  const timeLimit = getTxTimeLimit();

  const paymasterHash = await paymasterContract.getHash(
    userOp,
    "1",
    timeLimit[0],
    timeLimit[1],
    CoreTokenAddress,
    OracleAggregator,
    ethers.utils.parseUnits("1", 16),
    "1010000"
  );

  console.log("ERC20paymasterHash : ", paymasterHash);

  const paymasterSignature = await ERC20paymasterCall(paymasterHash);

  console.log("ERC20paymasterSignature : ", paymasterSignature);

  return paymasterSignature;
};

const getInitCode = async (address) => {

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const contract = new ethers.Contract(
    SimpleAccountFactoryAddress,
    SimpleAccountFactoryABI,
    signer
  );

  const initCode = "0x";
  await contract.createAccount(address, 0);
  const _SCWAddress = await contract.getAddress(address, 0);
  console.log("SCWAddress : ", _SCWAddress);

  return [initCode, _SCWAddress];
};

function convertBigIntToString(obj) {
  for (const key in obj) {
    if (typeof obj[key] === "bigint") {
      obj[key] = obj[key].toString();
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      convertBigIntToString(obj[key]);
    }
  }
}

class CustomJsonRpcProvider extends ethers.providers.JsonRpcProvider {
  async sendUserOperation(userOperation, entryPoint) {
    const method = "eth_sendUserOperation";
    // Convert BigInt to string
    convertBigIntToString(userOperation);
    const params = [userOperation, entryPoint];
    return this.send(method, params);
  }

  async getTxHashByUserOp(userOpHash) {
    const method = "eth_getUserOperationReceipt";
    // Convert BigInt to string
    const params = [userOpHash];
    return this.send(method, params);
  }
}

async function waitForReceipt(
  customProvider,
  userOpHash,
  interval = 1000,
  timeout = 60000
) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const res = await customProvider.getTxHashByUserOp(userOpHash);
      if (res) return res.receipt.transactionHash;
    } catch (error) {
      // Optionally handle specific errors
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error("Transaction res not found within timeout period");
}

async function getUserOpWithPaymaster (userOperation){

  const finalUserOp = await getPaymasterAndData(userOperation);

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();

  const EntryPoint = new ethers.Contract(
    EntryPointAddress,
    EntryPointABI,
    provider
  );

  const finalUserOpHash = await EntryPoint.getUserOpHash(finalUserOp);
  const signature = await signer.signMessage(ethers.utils.arrayify(finalUserOpHash));
  finalUserOp.signature = signature;

  return finalUserOpHash;

}

export {
  getUserOpWithPaymaster,
  getERC20PaymasterAndData,
  numberToHexString,
  getSCWallet,
  getUserOperation,
  CustomJsonRpcProvider,
  waitForReceipt,
};
