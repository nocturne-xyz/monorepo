import React, { useContext, useState } from "react";
import { ABIInteractionForm } from "./ABIInteractionForm";
import { ABIItem, tryParseABI } from "../utils/abiParser";
import { Button } from "./Buttons";
import * as ethers from "ethers";
import {
  NocturneFrontendSDK,
  formatAbbreviatedAddress,
  BundlerOperationID,
  formatTokenAmountUserRepr,
} from "@nocturne-xyz/frontend-sdk";
import { Asset, NocturneOpRequestBuilder } from "@nocturne-xyz/sdk";
import { ABIUnwrapForm } from "./ABIUnwrapForm";
import { ABIRefundAssetsForm } from "./ABIRefundAssetsForm";
import { MetaMaskContext, MetamaskActions } from "../hooks";
import { TxModal } from "../components/TxModal";
import {
  ActionWithSignature,
  JoinSplitRequestWithDecimals,
} from "../types/display";

export type ABIFormProps = {
  sdk: NocturneFrontendSDK;
  bundlerEndpoint: string;
};

export const ABIForm = ({ sdk, bundlerEndpoint }: ABIFormProps) => {
  const [abiText, setABIText] = useState("");
  const [contractAddressText, setContractAddressText] = useState("");
  const [abi, setABI] = useState<ABIItem[] | undefined>(undefined);
  const [contractAddress, setContractAddress] = useState<string | undefined>(
    undefined
  );
  const [actions, setActions] = useState<ActionWithSignature[]>([]);
  const [joinSplitRequests, setJoinSplitRequests] = useState<
    JoinSplitRequestWithDecimals[]
  >([]);
  const [refundAssets, setRefundAssets] = useState<Asset[]>([]);
  const [_state, dispatch] = useContext(MetaMaskContext);

  const [inFlightOperationID, setInFlightOperationID] = useState<
    BundlerOperationID | undefined
  >();
  const [txModalIsOpen, setTxModalIsOpen] = useState(false);

  const handleSetABI = (event: any) => {
    event.preventDefault();
    // validate contract address
    if (!ethers.utils.isAddress(contractAddressText)) {
      alert("Invalid contract address");
      return;
    }

    setContractAddress(contractAddressText);

    // parse ABI
    const abi = tryParseABI(abiText);
    console.log("abi:", abi);
    if (abi === undefined) {
      alert("Invalid ABI");
      return;
    }
    setABI(abi);
  };

  const handleAction = (action: ActionWithSignature) => {
    setActions([...actions, action]);
  };

  const handleJoinSplitRequest = (
    joinSplitRequest: JoinSplitRequestWithDecimals
  ) => {
    setJoinSplitRequests([...joinSplitRequests, joinSplitRequest]);
  };

  const handleRefundAsset = (refundAsset: Asset) => {
    setRefundAssets([...refundAssets, refundAsset]);
  };

  const submitOperation = async () => {
    const builder = new NocturneOpRequestBuilder();
    joinSplitRequests.map(j => j.joinSplitRequest).forEach(({ asset, unwrapValue }) => {
      builder.unwrap(asset, unwrapValue);
    });

    actions.forEach(({ action: { contractAddress, encodedFunction } }) => {
      builder.action(contractAddress, encodedFunction);
    });

    refundAssets.forEach((asset) => {
      builder.refundAsset(asset);
    });

    const operationRequest = builder.build();

    console.log("Operation request:", operationRequest);
    try {
      const provenOperation = await sdk.generateProvenOperation(
        operationRequest
      );
      console.log("Proven operation:", provenOperation);

      sdk
        .submitProvenOperation(provenOperation)
        .then((opID: BundlerOperationID) => {
          setInFlightOperationID(opID);
        })
        .catch((err: any) => {
          console.error(err);
          setInFlightOperationID(undefined);
        });

      openTxModal();
    } catch (e) {
      console.error("error: ", e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const openTxModal = () => {
    setTxModalIsOpen(true);
  };

  const handleCloseTxModal = () => {
    setTxModalIsOpen(false);
    setInFlightOperationID(undefined);
  };

  return (
    <>
      <TxModal
        operationId={inFlightOperationID}
        bundlerEndpoint={bundlerEndpoint}
        isOpen={txModalIsOpen}
        handleClose={handleCloseTxModal}
      />
      <label>
        Contract Address
        <br />
        <textarea
          style={{ resize: "none", width: "70%", height: "30px" }}
          value={contractAddressText}
          onChange={(event) => setContractAddressText(event.target.value)}
        />
      </label>
      <label>
        ABI Form
        <br />
        <textarea
          style={{ resize: "none", width: "70%", height: "100px" }}
          value={abiText}
          onChange={(event) => setABIText(event.target.value)}
        />
      </label>
      <Button onClick={handleSetABI}>Interact</Button>
      {abi && contractAddress ? (
        <>
          <br />
          <hr style={{ border: "0.25px solid white", width: "100%" }} />
          <div>
            <ABIUnwrapForm handleJoinSplitRequest={handleJoinSplitRequest} />
            <p>Currently unwrapping the following tokens and amounts...</p>
            {
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Address</th>
                    <th style={{ textAlign: "left" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {joinSplitRequests.map(({ joinSplitRequest, decimals }) => (
                    <tr key={joinSplitRequest.asset.assetAddr}>
                      <td
                        style={{
                          textAlign: "left",
                          color: "#ADD8E6",
                          cursor: "pointer",
                          paddingRight: "50px",
                        }}
                      >
                        {formatAbbreviatedAddress(
                          joinSplitRequest.asset.assetAddr
                        )}
                      </td>
                      <td style={{ textAlign: "left" }}>
                        {formatTokenAmountUserRepr(
                          joinSplitRequest.unwrapValue,
                          decimals
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          </div>

          <div>
            <br />
            <hr style={{ border: "0.25px solid white", width: "100%" }} />
            <ABIRefundAssetsForm handleNewRefundAsset={handleRefundAsset} />
            <p>Currently set to produce the following output tokens...</p>
            {
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {refundAssets.map(({ assetAddr }) => (
                    <tr key={assetAddr}>
                      <td
                        style={{
                          textAlign: "left",
                          color: "#ADD8E6",
                          cursor: "pointer",
                          paddingRight: "50px",
                        }}
                      >
                        {formatAbbreviatedAddress(assetAddr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          </div>
          <div>
            <br />
            <hr style={{ border: "0.25px solid white", width: "100%" }} />
            <h1 style={{ fontSize: "20px" }}>Contract Actions</h1>
            <ABIInteractionForm
              handleAction={handleAction}
              abi={abi}
              contractAddress={contractAddress}
            />
          </div>
          <p>Currently set to perform the following actions:</p>
          {
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Target</th>
                  <th style={{ textAlign: "left" }}>Call</th>
                </tr>
              </thead>
              <tbody>
                {actions.map(({ action, signature }) => (
                  <tr key={action.encodedFunction}>
                    <td
                      style={{
                        textAlign: "left",
                        color: "#ADD8E6",
                        cursor: "pointer",
                        paddingRight: "50px",
                      }}
                    >
                      {formatAbbreviatedAddress(action.contractAddress)}
                    </td>
                    <td style={{ textAlign: "left", overflow: "hidden" }}>
                      <div
                        style={{ maxWidth: "200px", wordWrap: "break-word" }}
                      >
                        <p>{signature}</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          <br />
          <div>
            <Button onClick={submitOperation}>
              <h1 style={{ fontSize: "16px" }}>Submit Operation</h1>
            </Button>
          </div>
        </>
      ) : (
        <></>
      )}
    </>
  );
};
