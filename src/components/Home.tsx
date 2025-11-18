import { usePages } from "@/hooks/nostr";
import { Preview } from "./Preview";
import { nip19 } from "nostr-tools";

export function Home() {
    const pages = usePages();
    return (
        <div>
            {pages?.map((page) => (
                <div key={page.id}>
                    <Preview ast={JSON.parse(page.content)} naddr={nip19.naddrEncode({ pubkey: page.pubkey, kind: 32616, identifier: page.id })} />
                </div>
            ))}
        </div>
    );
}