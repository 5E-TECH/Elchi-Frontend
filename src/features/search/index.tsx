// Search feature exports
export { GlobalSearchInput } from './ui/GlobalSearchInput';
export {
    setSearchValue,
    setMultipleSearchValues,
    removeSearchValue,
    clearAllSearch,
    syncFromUrlParams
} from './model/searchSlice';
export { default as searchReducer } from './model/searchSlice';

// Re-export useDebounce for convenience
export { useDebounce } from '../../shared/lib/useDebounce';
