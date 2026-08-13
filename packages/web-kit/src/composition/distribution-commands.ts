import { ProposeSocialCaption, PublishDuePosts, QueueSocialPost } from '@kurasikapa/application'
import type { Container, Infrastructure } from './container-types'
import type { mongoGraph } from './mongo-graph'
import { failClosedSocial } from './outbound'

export function distributionCommands(
  graph: ReturnType<typeof mongoGraph>,
  infra: Infrastructure,
): Pick<
  Container,
  'queueSocialPost' | 'proposeSocialCaption' | 'publishDuePosts' | 'socialPosts'
> {
  const { articles, revisions, socialPosts } = graph
  const { clock, ids } = infra

  return {
    queueSocialPost: new QueueSocialPost({ posts: socialPosts, articles, clock, ids }),
    proposeSocialCaption: new ProposeSocialCaption({ articles, revisions, ai: infra.ai }),
    publishDuePosts: new PublishDuePosts({
      posts: socialPosts,
      social: infra.social ?? failClosedSocial(),
      clock,
      siteUrl: infra.siteUrl ?? 'http://localhost:3000',
    }),
    socialPosts,
  }
}
