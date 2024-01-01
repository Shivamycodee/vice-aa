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
  GAS_FETCH_PRV,
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
  const _nonce = await contract.getNonce(address, 0);
  const nonce = ethers.utils.hexValue(_nonce);
  return nonce;
};

const getUserOperation = async (
  SCWAddress,
  callContract,
  minTx,
  PaymasterRPC_URL,
  PIMLICO_URL
) => {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const simpleAccount = new ethers.Contract(
    SCWAddress,
    SimpleAccountABI,
    provider
  );

  const NONCE = await getCurrnetNonce(SCWAddress);

  const userOperation = {
    sender: SCWAddress,
    nonce: NONCE,
    initCode: "0x",
    callData: simpleAccount.interface.encodeFunctionData("execute", [
      callContract,
      0,
      minTx.data,
    ]),
    callGasLimit: 0,
    verificationGasLimit: 0,
    preVerificationGas: 0,
    maxFeePerGas: 70_000_000_000,
    maxPriorityFeePerGas: 70_000_000_000,
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

  const userOpWithPaymasterAndData = await getPaymasterAndData(
    userOperation,
    PaymasterRPC_URL
  );
  userOperation.paymasterAndData = userOpWithPaymasterAndData.paymasterAndData;

  const res = await fetchGasValues(userOperation, PIMLICO_URL);
  userOperation.callGasLimit = res[0].toNumber();
  userOperation.verificationGasLimit = res[1].toNumber() + 1000;
  userOperation.preVerificationGas = res[2].toNumber();

  console.log("userOperation : ", userOperation);
  return userOperation;
};

function getTxTimeLimit() {
  const currentTime = Math.floor(Date.now() / 1000); // mili to sec
  const tenMinutesLater = currentTime;
  return [currentTime + 3600, tenMinutesLater];
}

async function getPaymasterAndData(userOperation, PaymasterRPC_URL) {

  const timeLimit = getTxTimeLimit();

  const signedPaymasterHash = await getSignedPaymasterHash(
    userOperation,
    PaymasterRPC_URL
  );

  let paymasterAndData = ethers.utils.concat([
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

async function getERC20PaymasterAndData(userOperation, PaymasterRPC_URL) {

  const paymasterSignature = await getSignedERC20PaymasterHash(
    userOperation,
    PaymasterRPC_URL
  );

  const priceSource = 1;
  const exchangeRate = ethers.utils.parseUnits("1", 16);
  const priceMarkup = 1e6 + 1e4;
  const priceSourceBytes = numberToHexString(priceSource);

  let paymasterAndData = ethers.utils.concat([
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

const fetchGasValues = async (userOperation, PIMLICO_URL) => {
  const tempProvider = new ethers.providers.JsonRpcProvider(MUMBAI_URL);
  const tempWallet = new ethers.Wallet(GAS_FETCH_PRV, tempProvider);

  const EntryPoint = new ethers.Contract(
    EntryPointAddress,
    EntryPointABI,
    tempWallet
  );

  const finalUserOpHash = await EntryPoint.getUserOpHash(userOperation);
  const finalUserOpSig = await tempWallet.signMessage(
    ethers.utils.arrayify(finalUserOpHash)
  );

  userOperation.signature = finalUserOpSig;
  const customProvider = new CustomJsonRpcProvider(PIMLICO_URL);

  const respond = await customProvider.getUserOperationGasEstimate(
    userOperation
  );

  const callGasLimit = ethers.BigNumber.from(respond.callGasLimit);
  const verificationGasLimit = ethers.BigNumber.from(
    respond.verificationGasLimit
  );
  const preVerificationGas = ethers.BigNumber.from(respond.preVerificationGas);
  return [callGasLimit, verificationGasLimit, preVerificationGas];
};

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

const getSignedPaymasterHash = async (userOp, PaymasterRPC_URL) => {
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

  const paymasterSignature = await paymasterCall(
    paymasterHash,
    PaymasterRPC_URL
  );

  console.log("paymasterSignature : ", paymasterSignature);

  return paymasterSignature;
};

const getSignedERC20PaymasterHash = async (userOp, ERC20_PaymasterRPC_URL) => {
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

  const paymasterSignature = await ERC20paymasterCall(
    paymasterHash,
    ERC20_PaymasterRPC_URL
  );

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

  async getUserOperationGasEstimate(userOperation) {
    const method = "eth_estimateUserOperationGas";
    const params = [userOperation, EntryPointAddress];
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


async function getSignedUserOp(userOperation,PaymasterRPC_URL,flag) {
  if (flag) {
    console.log("using paymaster...");
    userOperation = await getPaymasterAndData(userOperation, PaymasterRPC_URL);
  } else {
    console.log("using ERC20 paymaster...");
    userOperation = await getERC20PaymasterAndData(
      userOperation,
      PaymasterRPC_URL
    );
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const EntryPoint = new ethers.Contract(
    EntryPointAddress,
    EntryPointABI,
    signer
  );

  const finalUserOpHash = await EntryPoint.getUserOpHash(userOperation);
  const finalUserOpSig = await signer.signMessage(
    ethers.utils.arrayify(finalUserOpHash)
  );

  userOperation.signature = finalUserOpSig;
  return userOperation;
}

export {
  getERC20PaymasterAndData,
  numberToHexString,
  getSCWallet,
  getUserOperation,
  CustomJsonRpcProvider,
  waitForReceipt,
  getSignedUserOp,
};
