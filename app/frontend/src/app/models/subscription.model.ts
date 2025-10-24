export type SubscriptionType = 'ARTIST' | 'GENRE' | 'ALBUM';

export interface Subscription {
  subscriptionId: string; // Full subscription key as ID
  id: string; // Full subscription key as ID
  type: SubscriptionType;
  target_id: string;
  target_name: string;
  artistId: string; // For artist subscriptions
  emailNotifications: boolean;
  inAppNotifications: boolean;
  createdAt: string;
  created_at: string;
}

export interface CreateSubscriptionRequest {
  type: SubscriptionType;
  target_id: string;
}

export interface SubscriptionsResponse {
  user_id: string;
  subscriptions: Subscription[];
  grouped_subscriptions: {
    ARTIST: Subscription[];
    GENRE: Subscription[];
    ALBUM: Subscription[];
  };
  total_count: number;
  counts_by_type: {
    artists: number;
    genres: number;
    albums: number;
  };
}