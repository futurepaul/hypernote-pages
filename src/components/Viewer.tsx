import { usePage } from "@/hooks/nostr";
import { Preview } from "./Preview";
import { nip19 } from "nostr-tools";

export function Viewer({ id }: { id: string }) {
    console.log(id);
    const page = usePage(id);
    if (!page) {
        return <div>Loading...</div>;
    }

    console.log(page);

    return (
        <div>
            {<Preview ast={JSON.parse(page.content)} naddr={nip19.naddrEncode({ pubkey: page.pubkey, kind: 32616, identifier: page.id })} />}
        </div>
    );
}