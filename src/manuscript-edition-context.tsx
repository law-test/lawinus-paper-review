import {createContext,useContext,type ReactNode} from 'react';

export type ManuscriptEditionId='human73'|'v110';
const EditionContext=createContext<ManuscriptEditionId>('human73');
export function ManuscriptEditionProvider({edition,children}:{edition:ManuscriptEditionId;children:ReactNode}){
 return <EditionContext.Provider value={edition}>{children}</EditionContext.Provider>;
}
export function useManuscriptEditionId(){return useContext(EditionContext);}
