"use client";

import { useEffect, useCallback, useState } from "react";
import { useAccount, useWriteContract, useBalance } from "wagmi";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE } from "~/lib/constants";

function PizzaDonationCard() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });
  const [amount, setAmount] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  
  const { writeContract, isPending, isSuccess, error } = useWriteContract();

  const handleDonate = useCallback(() => {
    if (!amount || !tokenAddress) return;
    
    writeContract({
      abi: [{
        inputs: [
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" }
        ],
        name: "transfer",
        type: "function"
      }],
      address: tokenAddress as `0x${string}`,
      functionName: "transfer",
      args: ["0xaf48c7e443b7c17F226DD381e3C4Ed73E66788da", 
            BigInt(Number(amount) * 10**18)],
      chainId: base.id
    });
  }, [amount, tokenAddress, writeContract]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>🍕 Berlin Pizza Fund</CardTitle>
        <CardDescription>
          Contribute ERC20 tokens to feed Farcaster devs!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Your Wallet Address</Label>
          <Input value={address || "Not connected"} disabled />
        </div>
        
        <div className="space-y-2">
          <Label>Token Contract Address</Label>
          <Input
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            placeholder="0x..."
          />
        </div>
        
        <div className="space-y-2">
          <Label>Amount to Send</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1.0"
            step="0.1"
          />
        </div>

        <Button 
          onClick={handleDonate}
          disabled={isPending || !amount || !tokenAddress}
        >
          {isPending ? "Sending..." : "Send Pizza Funds"}
        </Button>

        {isSuccess && (
          <div className="text-green-500">
            Payment sent successfully! 🎉
          </div>
        )}
        {error && (
          <div className="text-red-500">
            Error: {error.message}
          </div>
        )}
        
        {txHash && (
          <div className="text-sm text-muted-foreground">
            TX: {truncateAddress(txHash)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();

  const [added, setAdded] = useState(false);

  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    };
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-2 px-2">
        <PizzaDonationCard />
      </div>
    </div>
  );
}
