import { memo } from "react";
import { useRealtimeData } from "../hooks/useRealtimeData";
import { AnimatedNumber } from "./AnimatedNumber";

export const LiveBidAmount = memo(function LiveBidAmount({
  auctionId,
  sold = false,
  soldPrice = 0,
  animated = false,
  className = "",
}) {
  const { data: liveBidData } = useRealtimeData(
    auctionId ? `auctions/${auctionId}/live_state/bid` : null,
  );
  const { data: legacyBidData } = useRealtimeData(
    auctionId ? `auctions/${auctionId}/live_state/currentBid` : null,
  );

  const liveBid = Number(liveBidData ?? legacyBidData ?? 0);
  const displayBid = sold ? Number(soldPrice) || 0 : liveBid;

  if (animated) {
    return <AnimatedNumber value={displayBid} className={className} />;
  }

  return (
    <span className={className}>
      ₹{displayBid.toLocaleString()}
    </span>
  );
});

