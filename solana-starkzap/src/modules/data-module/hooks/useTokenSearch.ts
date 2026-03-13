import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TokenInfo } from '../types/tokenTypes';
import { fetchTokenList, searchTokens, TokenSearchParams, TokenListParams } from '../services/tokenService';

const TOKEN_FETCH_TIMEOUT = 15000;

const FALLBACK_TOKENS: TokenInfo[] = [
  { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Solana', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', name: 'Tether USD', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/icon.png' },
  { address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', name: 'Jupiter', decimals: 6, logoURI: 'https://static.jup.ag/jup/icon.png' },
  { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk', decimals: 5, logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
  { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', name: 'dogwifhat', decimals: 6, logoURI: 'https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betiber5vc77j72kbctzli.ipfs.nftstorage.link' },
  { address: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', symbol: 'JTO', name: 'Jito', decimals: 9, logoURI: 'https://coin-images.coingecko.com/coins/images/33228/large/jto.png' },
  { address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', symbol: 'PYTH', name: 'Pyth Network', decimals: 6, logoURI: 'https://coin-images.coingecko.com/coins/images/31924/large/pyth.png' },
  { address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', symbol: 'RAY', name: 'Raydium', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png' },
  { address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', symbol: 'mSOL', name: 'Marinade staked SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png' },
  { address: 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v', symbol: 'jupSOL', name: 'Jupiter Staked SOL', decimals: 9, logoURI: 'https://static.jup.ag/jupSOL/icon.png' },
  { address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', symbol: 'ETH', name: 'Ether (Wormhole)', decimals: 8, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png' },
  { address: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', symbol: 'WBTC', name: 'Wrapped BTC (Wormhole)', decimals: 8, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh/logo.png' },
  { address: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux', symbol: 'HNT', name: 'Helium', decimals: 8, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux/logo.png' },
  { address: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', symbol: 'RNDR', name: 'Render Token', decimals: 8, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof/logo.png' },
];

interface UseTokenSearchResult {
  tokens: TokenInfo[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loadMore: () => void;
  refresh: () => void;
  isRefreshing: boolean;
}

/**
 * Hook for searching and listing tokens with debounce functionality
 */
export function useTokenSearch(
  initialQuery: string = '', 
  debounceMs: number = 300
): UseTokenSearchResult {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState<string>(initialQuery);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  
  // Refs to track fetch operations and prevent stale closures
  const isMounted = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchInProgress = useRef<boolean>(false);
  
  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // Setup debounce mechanism for search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      // Reset pagination when query changes
      setOffset(0);
      setHasMore(true);
    }, debounceMs);
    
    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, debounceMs]);
  
  // Function to fetch tokens based on search query with timeout handling
  const fetchTokens = useCallback(async (isLoadingMore: boolean = false, isRefreshRequest: boolean = false) => {
    // Prevent concurrent fetch operations
    if (fetchInProgress.current) {
      console.log('[useTokenSearch] Fetch already in progress, skipping');
      return;
    }
    
    try {
      fetchInProgress.current = true;
      setError(null);
      
      if (!isLoadingMore) {
        // Only show loading if we're not loading more or refreshing
        if (!isRefreshRequest) {
          setLoading(true);
        } else {
          setIsRefreshing(true);
        }
      }
      
      // Prepare parameters based on search type
      let fetchPromise: Promise<TokenInfo[]>;
      if (debouncedQuery.trim() === '') {
        // If no search query, fetch top tokens sorted by market cap
        const params: TokenListParams = {
          sort_by: 'market_cap',
          sort_type: 'desc',
          offset: isLoadingMore ? offset : 0,
          limit: 20
        };
        
        fetchPromise = fetchTokenList(params);
      } else {
        // If we have a search query, use the search API
        const params: TokenSearchParams = {
          keyword: debouncedQuery,
          sort_by: 'volume_24h_usd',
          sort_type: 'desc',
          offset: isLoadingMore ? offset : 0,
          limit: 20
        };
        
        fetchPromise = searchTokens(params);
      }
      
      // Setup timeout for the fetch operation
      const timeoutPromise = new Promise<TokenInfo[]>((_, reject) => {
        timeoutRef.current = setTimeout(() => {
          reject(new Error('Token fetch timeout, please try again.'));
        }, TOKEN_FETCH_TIMEOUT);
      });
      
      // Race between fetch and timeout
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      
      // Clear timeout if fetch succeeded
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (!isMounted.current) return;
      
      // Filter out tokens with invalid or missing required properties
      const validTokens = result.filter(token => 
        token && 
        token.address && 
        (token.symbol !== null && token.symbol !== undefined) &&
        (token.name !== null && token.name !== undefined) &&
        (token.decimals !== null && token.decimals !== undefined)
      );
      
      if (validTokens.length === 0 && !isLoadingMore) {
        setHasMore(false);
        if (debouncedQuery.trim() === '') {
          setTokens(FALLBACK_TOKENS);
        } else {
          const query = debouncedQuery.toLowerCase();
          const filtered = FALLBACK_TOKENS.filter(t =>
            t.symbol.toLowerCase().includes(query) ||
            t.name.toLowerCase().includes(query) ||
            t.address.toLowerCase() === query
          );
          setTokens(filtered);
        }
      } else if (validTokens.length === 0 && isLoadingMore) {
        // If no more results when loading more, mark as no more
        setHasMore(false);
      } else {
        // If loading more, append to current list; otherwise replace
        setTokens(prev => isLoadingMore ? [...prev, ...validTokens] : validTokens);
        
        // Update offset for pagination
        if (isLoadingMore) {
          setOffset(prev => prev + 20);
        } else if (!isLoadingMore) {
          setOffset(20); // Set to 20 for future load more operations
        }
      }
    } catch (err) {
      if (!isMounted.current) return;
      
      console.error('Error in useTokenSearch:', err);
      
      // Handle error case
      if (err instanceof Error) {
        setError(err.message || 'Failed to fetch tokens');
      } else {
        setError('Failed to fetch tokens, please try again');
      }
      
      // Don't clear tokens on load more failure
      if (!isLoadingMore && tokens.length === 0) {
        // Set some fallback tokens if we couldn't load any
        setTokens([
          {
            address: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Solana',
            decimals: 9,
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
          },
          {
            address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
          }
        ]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsRefreshing(false);
        fetchInProgress.current = false;
      }
    }
  }, [debouncedQuery, offset, tokens.length]);
  
  // Fetch tokens when debounced query changes
  useEffect(() => {
    fetchTokens();
  }, [debouncedQuery, fetchTokens]);
  
  // Load more tokens (pagination)
  const loadMore = useCallback(() => {
    if (!loading && hasMore && !fetchInProgress.current) {
      fetchTokens(true);
    }
  }, [loading, hasMore, fetchTokens]);
  
  // Refresh the token list
  const refresh = useCallback(() => {
    if (!fetchInProgress.current) {
      setOffset(0);
      setHasMore(true);
      fetchTokens(false, true);
    }
  }, [fetchTokens]);
  
  return useMemo(() => ({
    tokens,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
    isRefreshing
  }), [tokens, loading, error, searchQuery, loadMore, refresh, isRefreshing]);
} 