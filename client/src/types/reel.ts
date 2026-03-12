export interface Reel {
    id: string;
    userId: string;
    type: "photo" | "reel";
    mediaUrl: string;
    thumbnailUrl?: string;
    caption?: string;
    duration?: number;
    visibility: "public" | "private";
    likeCount: number;
    viewCount: number;
    commentCount: number;
    saveCount: number;
    isStoryActive?: boolean;
    createdAt: string;
    username: string;
    displayName?: string;
    avatar?: string;
    countryCode?: string;
    liked?: boolean;
    saved?: boolean;
    isFollowing?: boolean;
}

export interface ReelComment {
    id: string;
    userId: string;
    text: string;
    username: string;
    displayName?: string;
    avatar?: string;
    createdAt: string;
}
