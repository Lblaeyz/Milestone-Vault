import { formatEther } from 'viem';

export const formatMON = (wei: bigint | undefined | string): string => {
  if (wei === undefined || wei === null) return '—';
  try {
    return parseFloat(formatEther(BigInt(wei))).toFixed(4) + ' MON';
  } catch (e) {
    return '—';
  }
};

export const shortenAddress = (addr: string): string =>
  addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : '—';
