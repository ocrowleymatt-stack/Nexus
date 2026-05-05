
import { GraphBuilder } from '../graph/buildGraph';
import { getZipJson } from './zipInspector';
import { SourceRef } from '../../types/graph';

export async function processFacebookExport(zipFile: File, paths: string[]): Promise<GraphBuilder> {
  console.log("[FACEBOOK_IMPORTER] Processing ZIP paths. Total files:", paths.length);
  const builder = new GraphBuilder();
  
  // 1. Profile Information
  const profilePath = paths.find(p => p.includes('profile_information.json'));
  console.log("[FACEBOOK_IMPORTER] Checking profile at:", profilePath);
  if (profilePath) {
    const data = await getZipJson(zipFile, profilePath);
    if (data?.profile_v2) {
      console.log("[FACEBOOK_IMPORTER] Profile information found");
      const p = data.profile_v2;
      builder.addNode({
        name: p.name?.full_name || "User Profile",
        type: "Person",
        group: "Self",
        description: `Facebook Profile: ${p.emails?.map((e: any) => e.email).join(', ')}`,
        source_ref: {
          source_type: "facebook_export",
          source_file: profilePath,
          source_confidence: "direct"
        }
      });
    }
  }

  // 2. Friends
  const friendsPath = paths.find(p => p.includes('friends.json'));
  if (friendsPath) {
    const data = await getZipJson(zipFile, friendsPath);
    if (data?.friends_v2) {
      data.friends_v2.forEach((friend: any, index: number) => {
        const friendId = builder.addNode({
          name: friend.name,
          type: "Person",
          group: "Social Network",
          source_ref: {
            source_type: "facebook_export",
            source_file: friendsPath,
            source_index: index,
            source_confidence: "direct"
          }
        });
        
        builder.addLink({
          source: "user_profile", // Assuming self is user_profile
          target: friendId,
          relationship: "FRIEND_OF",
          source_ref: {
            source_type: "facebook_export",
            source_file: friendsPath,
            source_index: index,
            source_confidence: "direct"
          }
        });
      });
    }
  }

  // 3. Messages (Inbox)
  const messageFiles = paths.filter(p => p.includes('messages/inbox/') && p.endsWith('message_1.json'));
  for (const msgPath of messageFiles.slice(0, 50)) { // Cap to 50 threads
    const data = await getZipJson(zipFile, msgPath);
    if (data?.participants && data?.messages) {
      const threadName = data.title || "Message Thread";
      const threadId = builder.addNode({
        name: threadName,
        type: "Conversation",
        group: "Communications",
        source_ref: {
          source_type: "facebook_export",
          source_file: msgPath,
          source_confidence: "direct"
        }
      });

      data.participants.forEach((p: any) => {
        const pId = builder.addNode({
          name: p.name,
          type: "Person",
          source_ref: {
            source_type: "facebook_export",
            source_file: msgPath,
            source_confidence: "direct"
          }
        });
        builder.addLink({ 
          source: pId, 
          target: threadId, 
          relationship: "PARTICIPATED_IN" 
        });
      });
    }
  }

  return builder;
}
