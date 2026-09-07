// Search feature exports
export { GlobalSearchInput } from '../../shared/ui/GlobalSearchInput';
export {
    setSearchValue,
    setMultipleSearchValues,
    removeSearchValue,
    clearAllSearch,
    syncFromUrlParams
} from '../../shared/model/searchSlice';
export { default as searchReducer } from '../../shared/model/searchSlice';

// Re-export useDebounce for convenience
export { useDebounce } from '../../shared/lib/useDebounce';
