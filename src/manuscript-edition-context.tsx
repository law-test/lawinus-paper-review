import {createContext,useContext,type ReactNode} from 'react';

export type ManuscriptEditionId='human80'|'v120'|'v121'|'v122'|'v123'|'v124';
const EditionContext=createContext<ManuscriptEditionId>('human80');
export function ManuscriptEditionProvider({edition,children}:{edition:ManuscriptEditionId;children:ReactNode}){
 return <EditionContext.Provider value={edition}>{children}</EditionContext.Provider>;
}
export function useManuscriptEditionId(){return useContext(EditionContext);}
