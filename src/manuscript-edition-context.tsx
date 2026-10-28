import {createContext,useContext,type ReactNode} from 'react';

export type ManuscriptEditionId='human77'|'v112';
const EditionContext=createContext<ManuscriptEditionId>('human77');
export function ManuscriptEditionProvider({edition,children}:{edition:ManuscriptEditionId;children:ReactNode}){
 return <EditionContext.Provider value={edition}>{children}</EditionContext.Provider>;
}
export function useManuscriptEditionId(){return useContext(EditionContext);}
