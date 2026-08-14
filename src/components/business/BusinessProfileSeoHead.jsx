import React from 'react';
import { Helmet } from 'react-helmet-async';
import { getSafeAvatar } from '../../utils/avatarUtils';

export default function BusinessProfileSeoHead({ profile }) {
  const { business, businessInfo, profileId, profileCoverUrl, jsonLd } = profile;

  if (!business) return null;

  return (
    <Helmet>
            <title>{business.display_name} {businessInfo?.city ? `in ${businessInfo.city}` : ''} - {businessInfo?.businessType || 'Venue'} | DineBuddies</title>
            <meta name="description" content={businessInfo?.description || businessInfo?.tagline || `Explore the details, reviews, and exclusive photos of ${business.display_name} on DineBuddies.`} />
            <link rel="canonical" href={`https://www.dinebuddies.com/business/${profileId}`} />
            <meta property="og:url" content={`https://www.dinebuddies.com/business/${profileId}`} />
            <meta property="og:title" content={`${business.display_name} - DineBuddies`} />
            <meta property="og:description" content={businessInfo?.description || businessInfo?.tagline || `Checkout ${business.display_name} on DineBuddies!`} />
            <meta property="og:image" content={profileCoverUrl || getSafeAvatar(business)} />
            <meta property="twitter:card" content="summary_large_image" />
            {jsonLd &&
      <script type="application/ld+json">
                    {JSON.stringify(jsonLd)}
                </script>
      }
        </Helmet>);

}
