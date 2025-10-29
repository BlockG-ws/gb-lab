import { getActivityPubService } from '@/plugins/activitypub/service';
import { getActivityPubConfig } from '@/plugins/activitypub/config';

// Hook to publish blog posts to ActivityPub
export async function publishToActivityPub(post: {
  title: string;
  content: string;
  slug: string;
  excerpt?: string;
}) {
  try {
    const config = getActivityPubConfig();
    if (!config.federation.enabled) {
      console.log('ActivityPub federation is disabled');
      return;
    }

    const service = getActivityPubService();
    const postUrl = `${config.baseUrl}/blog/${post.slug}`;
    
    // Create a summary for ActivityPub (use excerpt or truncated content)
    const summary = post.excerpt || (post.content.length > 500 
      ? post.content.substring(0, 500) + '...' 
      : post.content);

    await service.publishPost(post.title, summary, postUrl);
    console.log(`Published post "${post.title}" to ActivityPub`);
  } catch (error) {
    console.error('Error publishing to ActivityPub:', error);
  }
}

// Initialize ActivityPub on server start
export async function initializeActivityPub() {
  try {
    const service = getActivityPubService();
    await service.initializeActor();
    console.log('ActivityPub initialized successfully');
  } catch (error) {
    console.error('Error initializing ActivityPub:', error);
  }
}
