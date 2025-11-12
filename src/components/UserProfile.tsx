import { useProfile } from "@/hooks/nostr";
import { getDisplayName, getProfilePicture } from "applesauce-core/helpers";

export function UserProfile({ pubkey }: { pubkey: string }) {
  const profile = useProfile(pubkey);

  return (
    <div className="flex items-center gap-2">
        <img
            className="rounded-full w-10 h-10 object-cover"
            src={getProfilePicture(profile, `https://robohash.org/${pubkey}.png`)}
            alt={getDisplayName(profile)}
          />
        <span className="text-xs">{getDisplayName(profile)}</span>
    </div>
  );
}
