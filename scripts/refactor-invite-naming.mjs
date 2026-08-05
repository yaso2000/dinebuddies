/**
 * Two-step invite type rename (run from repo root):
 *   STEP 1: old Private (30 guests) → Social
 *   STEP 2: old Dating (1-on-1) → Private
 *
 * Usage: node scripts/refactor-invite-naming.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DRY = process.argv.includes('--dry-run');

const SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    '.git',
    'backups',
    '_backups',
    '.agent',
]);

const TEXT_EXT = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.md', '.mjs', '.cjs', '.rules',
]);

/** @param {string} dir @returns {string[]} */
function walk(dir) {
    const out = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(ent.name)) continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) out.push(...walk(full));
        else out.push(full);
    }
    return out;
}

/** @param {string} dir @param {[string, string][]} pairs */
function renameFilesInDir(dir, pairs) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir)) {
        let newName = ent;
        for (const [from, to] of pairs) {
            newName = newName.split(from).join(to);
        }
        if (newName !== ent) {
            renameFile(path.join(dir, ent), path.join(dir, newName));
        }
    }
}

/** @param {string} from @param {string} to */
function renameFile(from, to) {
    if (!fs.existsSync(from)) {
        console.warn('skip missing:', from);
        return;
    }
    if (fs.existsSync(to)) {
        console.warn('skip exists:', to);
        return;
    }
    console.log('rename:', path.relative(ROOT, from), '→', path.relative(ROOT, to));
    if (!DRY) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.renameSync(from, to);
    }
}

/** @param {string} file @param {[string, string][]} pairs */
function replaceInFile(file, pairs) {
    if (!TEXT_EXT.has(path.extname(file))) return false;
    let text = fs.readFileSync(file, 'utf8');
    const orig = text;
    for (const [from, to] of pairs) {
        if (!text.includes(from)) continue;
        text = text.split(from).join(to);
    }
    if (text !== orig) {
        if (!DRY) fs.writeFileSync(file, text, 'utf8');
        return true;
    }
    return false;
}

/** @param {[string, string][]} pairs @param {string[]} roots */
function replaceInTree(pairs, roots) {
    const changed = [];
    for (const rootRel of roots) {
        const root = path.join(ROOT, rootRel);
        if (!fs.existsSync(root)) continue;
        const files = fs.statSync(root).isDirectory() ? walk(root) : [root];
        for (const file of files) {
            if (replaceInFile(file, pairs)) changed.push(path.relative(ROOT, file));
        }
    }
    return changed;
}

// ─── STEP 1: file renames (old Private → Social) ───────────────────────────
const step1Renames = [
    ['src/pages/CreatePrivateInvitation.jsx', 'src/pages/CreateSocialInvitation.jsx'],
    ['src/pages/PrivateInvitationDetails.jsx', 'src/pages/SocialInvitationDetails.jsx'],
    ['src/pages/PrivateInvitationPreview.jsx', 'src/pages/SocialInvitationPreview.jsx'],
    ['src/pages/PrivateInvitation.css', 'src/pages/SocialInvitation.css'],
    ['src/pages/PublicPrivateInvitationJoin.jsx', 'src/pages/PublicSocialInvitationJoin.jsx'],
    ['src/components/Invitation/PrivateInvitationInfoGrid.jsx', 'src/components/Invitation/SocialInvitationInfoGrid.jsx'],
    ['src/utils/privateInvitationDraft.js', 'src/utils/socialInvitationDraft.js'],
    ['src/utils/sharePrivateInvitationCardImage.js', 'src/utils/shareSocialInvitationCardImage.js'],
    ['src/utils/syncInvitedPrivateInvitations.js', 'src/utils/syncInvitedSocialInvitations.js'],
    ['src/components/Invitations/privateCard', 'src/components/Invitations/socialCard'],
];

// ─── STEP 2: file renames (old Dating → Private) ─────────────────────────────
const step2Renames = [
    ['src/pages/CreateDatingInvitation.jsx', 'src/pages/CreatePrivateInvitation.jsx'],
    ['src/components/DatingInviteProfileBadge.jsx', 'src/components/PrivateInviteProfileBadge.jsx'],
    ['src/components/DatingInviteProfileBadge.css', 'src/components/PrivateInviteProfileBadge.css'],
    ['src/components/Invitation/DatingInvitationSplash.jsx', 'src/components/Invitation/PrivateInvitationSplash.jsx'],
    ['src/utils/datingInviteAvailability.js', 'src/utils/privateInviteAvailability.js'],
    ['src/utils/datingInvitationAiPrompt.js', 'src/utils/privateInvitationAiPrompt.js'],
    ['src/utils/datingAiRequestPayload.js', 'src/utils/privateAiRequestPayload.js'],
    ['src/constants/datingProfileOptions.js', 'src/constants/privateProfileOptions.js'],
    ['src/components/profile/DatingProfileFields.jsx', 'src/components/profile/PrivateProfileFields.jsx'],
    ['src/components/profile/DatingProfileFields.css', 'src/components/profile/PrivateProfileFields.css'],
    ['api/_datingAiPersonalization.js', 'api/_privateAiPersonalization.js'],
    ['scripts/sync-dating-invitation-templates.mjs', 'scripts/sync-private-invitation-templates.mjs'],
    ['dating-invitation-templates', 'private-invitation-templates'],
    ['public/dating-invitation-templates', 'public/private-invitation-templates'],
    ['src/components/Invitations/datingCard', 'src/components/Invitations/privateCard'],
    ['src/components/Invitations/socialCard/DatingCardPreviewStage.jsx', 'src/components/Invitations/privateCard/PrivateCardPreviewStage.jsx'],
    ['src/components/Invitations/socialCard/DatingCardPreviewStage.css', 'src/components/Invitations/privateCard/PrivateCardPreviewStage.css'],
    ['src/components/Invitations/socialCard/DatingCardThemeColorPanel.jsx', 'src/components/Invitations/privateCard/PrivateCardThemeColorPanel.jsx'],
    ['src/components/Invitations/socialCard/DatingCardThemeColorPanel.css', 'src/components/Invitations/privateCard/PrivateCardThemeColorPanel.css'],
    ['src/components/Invitations/socialCard/DatingCardTypographyBars.jsx', 'src/components/Invitations/privateCard/PrivateCardTypographyBars.jsx'],
    ['src/components/Invitations/socialCard/DatingCardTypographyBars.css', 'src/components/Invitations/privateCard/PrivateCardTypographyBars.css'],
    ['src/components/Invitations/socialCard/PrivateCardDatingTypographySheet.jsx', 'src/components/Invitations/privateCard/PrivateCardTypographySheet.jsx'],
    ['src/components/Invitations/socialCard/PrivateCardDatingTypographySheet.css', 'src/components/Invitations/privateCard/PrivateCardTypographySheet.css'],
    ['src/components/Invitations/privateCard/datingCardBackgrounds.js', 'src/components/Invitations/privateCard/privateCardBackgrounds.js'],
    ['src/components/Invitations/privateCard/DatingCoverCameraPanel.jsx', 'src/components/Invitations/privateCard/PrivateCoverCameraPanel.jsx'],
    ['src/components/Invitations/privateCard/DatingInvitationPairShowcase.jsx', 'src/components/Invitations/privateCard/PrivateInvitationPairShowcase.jsx'],
    ['src/components/Invitations/privateCard/DatingInvitationPairShowcase.css', 'src/components/Invitations/privateCard/PrivateInvitationPairShowcase.css'],
    ['src/components/Invitations/privateCard/DatingPreviewRightRail.jsx', 'src/components/Invitations/privateCard/PrivatePreviewRightRail.jsx'],
    ['src/components/Invitations/privateCard/DatingPreviewRightRail.css', 'src/components/Invitations/privateCard/PrivatePreviewRightRail.css'],
];

const step1Replacements = [
    // Routes (social paths first; dating still uses /invitation/private until step 2)
    ['/create-private', '/create-social'],
    ['/invitation/private/preview/', '/invitation/social/preview/'],
    // Social details path — applied before step 2 retargets dating to /invitation/private
    ['`/invitation/private/${', '`/invitation/social/${'],
    ["'/invitation/private/' +", "'/invitation/social/' +"],
    ['/invitation/private/`', '/invitation/social/`'],

    // Components / pages (after file renames)
    ['CreatePrivateInvitation', 'CreateSocialInvitation'],
    ['PrivateInvitationDetails', 'SocialInvitationDetails'],
    ['PrivateInvitationPreview', 'SocialInvitationPreview'],
    ['PublicPrivateInvitationJoin', 'PublicSocialInvitationJoin'],
    ['PrivateInvitationInfoGrid', 'SocialInvitationInfoGrid'],
    ['PrivateInvitation.css', 'SocialInvitation.css'],

    // Utils paths
    ['privateInvitationDraft', 'socialInvitationDraft'],
    ['sharePrivateInvitationCardImage', 'shareSocialInvitationCardImage'],
    ['syncInvitedPrivateInvitations', 'syncInvitedSocialInvitations'],
    ['/Invitations/privateCard/', '/Invitations/socialCard/'],
    ['Invitations/privateCard', 'Invitations/socialCard'],

    // Card component symbols (social card folder)
    ['PrivateInvitationCardPreview', 'SocialInvitationCardPreview'],
    ['PrivateInvitationInviteePanel', 'SocialInvitationInviteePanel'],
    ['PrivateInvitationExternalShare', 'SocialInvitationExternalShare'],
    ['PrivateInvitationEditorFooter', 'SocialInvitationEditorFooter'],
    ['PrivateInvitationCoverRightRail', 'SocialInvitationCoverRightRail'],
    ['PrivateInvitationAiCoverPanel', 'SocialInvitationAiCoverPanel'],
    ['PrivateInvitationShareCapture', 'SocialInvitationShareCapture'],
    ['HostPrivateInvitationCardExport', 'HostSocialInvitationCardExport'],
    ['buildPrivateInvitationCardPreviewProps', 'buildSocialInvitationCardPreviewProps'],
    ['PrivateCardBackgroundPicker', 'SocialCardBackgroundPicker'],
    ['PrivateCardCategoryIcon', 'SocialCardCategoryIcon'],
    ['privateCardOccasionMap', 'socialCardOccasionMap'],
    ['privateCardTextBackdrop', 'socialCardTextBackdrop'],
    ['privateCardThemeColor', 'socialCardThemeColor'],
    ['privateCardShowHostAndMessage', 'socialCardShowHostAndMessage'],
    ['privateCardTextBackdropTone', 'socialCardTextBackdropTone'],

    // Category / type discriminators (old private invite)
    ["inviteCategory: 'private'", "inviteCategory: 'social'"],
    ['inviteCategory === \'private\'', 'inviteCategory === \'social\''],
    ["kind === 'private'", "kind === 'social'"],
    ["kind = 'private'", "kind = 'social'"],
    ["invOrKind === 'private'", "invOrKind === 'social'"],
    ["'private' | 'dating'", "'social' | 'dating'"],
    ["type: 'Private'", "type: 'Social'"],
    ["type === 'Private'", "type === 'Social'"],
    ["occasionType: 'Private'", "occasionType: 'Social'"],
    ["subType: 'private'", "subType: 'social'"],
    ["subType === 'private'", "subType === 'social'"],

    // Invitation doc privacy field (hosted invites in private_invitations collection)
    ["privacy: 'private',", "privacy: 'social',"],
    ["privacy === 'private' ? 'private_invitations'", "privacy === 'social' ? 'private_invitations'"],
    ["inv.privacy === 'private' ? 'private_invitations'", "inv.privacy === 'social' ? 'private_invitations'"],
    ["invData.privacy === 'private' ? 'private_invitations'", "invData.privacy === 'social' ? 'private_invitations'"],
    ["isPrivate = false", "isHosted = false"],
    ["isPrivate ? 'private_invitations'", "isHosted ? 'private_invitations'"],
    ["deleteInvitation(invId, isPrivate", "deleteInvitation(invId, isHosted"],

    // Constants
    ['PRIVATE_INVITATION_PUBLISH_CREDITS', 'SOCIAL_INVITATION_PUBLISH_CREDITS'],
    ['PRIVATE_INVITATION_MAX_GUESTS', 'SOCIAL_INVITATION_MAX_GUESTS'],
    ['PRIVATE_MAX_GUESTS', 'SOCIAL_MAX_GUESTS'],
    ['PRIVATE_INVITATION_PUBLISH', 'SOCIAL_INVITATION_PUBLISH'],
    ['publish_private_invitation', 'publish_social_invitation'],
    ['claim_private_invitation_share', 'claim_social_invitation_share'],

    // Context naming — collection holds both kinds; use neutral hosted* for list state
    ['canCreatePrivateInvitation', 'canCreateHostedInvitation'],
    ['addPrivateInvitation', 'addHostedInvitation'],
    ['resolvePrivateInviteCategory', 'resolveInviteCategory'],

    // Notifications (social)
    ["'private_invitation'", "'social_invitation'"],
    ["'private_invitation_response'", "'social_invitation_response'"],
    ["'private_invitation_publish'", "'social_invitation_publish'"],

    // CSS classes
    ['private-invitation-card-preview', 'social-invitation-card-preview'],
    ['private-invitee-panel', 'social-invitee-panel'],
    ['public-private-invite-join', 'public-social-invite-join'],
    ['host-private-invitation-card-export', 'host-social-invitation-card-export'],
    ['private-invite-cover-rail', 'social-invite-cover-rail'],

    // i18n keys (shared editor + social product)
    ["t('private_", "t('social_"],
    ['"private_', '"social_'],
    ["'private_", "'social_"],

    // Admin
    ['admin_invitations_type_private', 'admin_invitations_type_social'],
    ['admin_home_inv_private', 'admin_home_inv_social'],
    ['type_private', 'type_social'],
    ['stats_private', 'stats_social'],
    ['create_private_invitation', 'create_social_invitation'],
    ['invite_create_private_', 'invite_create_social_'],
];

const step2Replacements = [
    // Routes: dating → private
    ['/create-dating', '/create-private'],
    // Dating used /invitation/private — becomes canonical private path
    // Social already on /invitation/social from step 1

    // File / component renames
    ['CreateDatingInvitation', 'CreatePrivateInvitation'],
    ['DatingInviteProfileBadge', 'PrivateInviteProfileBadge'],
    ['DatingInvitationSplash', 'PrivateInvitationSplash'],
    ['datingInviteAvailability', 'privateInviteAvailability'],
    ['datingInvitationAiPrompt', 'privateInvitationAiPrompt'],
    ['datingAiRequestPayload', 'privateAiRequestPayload'],
    ['datingProfileOptions', 'privateProfileOptions'],
    ['DatingProfileFields', 'PrivateProfileFields'],
    ['_datingAiPersonalization', '_privateAiPersonalization'],
    ['sync-dating-invitation-templates', 'sync-private-invitation-templates'],
    ['dating-invitation-templates', 'private-invitation-templates'],

    // datingCard folder → privateCard (step 2 renames folder; social stays socialCard)
    ['/Invitations/datingCard/', '/Invitations/privateCard/'],
    ['Invitations/datingCard', 'Invitations/privateCard'],
    ['datingCardBackgrounds', 'privateCardBackgrounds'],
    ['DatingCoverCameraPanel', 'PrivateCoverCameraPanel'],
    ['DatingInvitationPairShowcase', 'PrivateInvitationPairShowcase'],
    ['DatingPreviewRightRail', 'PrivatePreviewRightRail'],
    ['DatingCardPreviewStage', 'PrivateCardPreviewStage'],
    ['DatingCardThemeColorPanel', 'PrivateCardThemeColorPanel'],
    ['DatingCardTypographyBars', 'PrivateCardTypographyBars'],
    ['PrivateCardDatingTypographySheet', 'PrivateCardTypographySheet'],

    // Category / type discriminators (old dating → new private)
    ["inviteCategory: 'dating'", "inviteCategory: 'private'"],
    ['inviteCategory === \'dating\'', 'inviteCategory === \'private\''],
    ["kind === 'dating'", "kind === 'private'"],
    ["kind = 'dating'", "kind = 'private'"],
    ["invOrKind === 'dating'", "invOrKind === 'private'"],
    ["'social' | 'dating'", "'social' | 'private'"],
    ["type: 'Dating'", "type: 'Private'"],
    ["type === 'Dating'", "type === 'Private'"],
    ["occasionType: 'Dating'", "occasionType: 'Private'"],
    ["occasionType: 'dating'", "occasionType: 'private'"],
    ["occasionLc === 'dating'", "occasionLc === 'private'"],
    ["subType: 'date'", "subType: 'private'"],
    ["subType === 'date'", "subType === 'private'"],

    // Profile / availability
    ['availableForDating', 'availableForPrivateInvite'],
    ['isUserAvailableForDating', 'isUserAvailableForPrivateInvite'],
    ['fetchDatingEligibilityByUserIds', 'fetchPrivateInviteEligibilityByUserIds'],
    ['mergeDatingEligibility', 'mergePrivateInviteEligibility'],
    ['getDatingInviteeDisplayName', 'getPrivateInviteeDisplayName'],
    ['isDatingPrivateInvitation', 'isPrivateHostedInvitation'],
    ['isDatingInvitationDoc', 'isPrivateInvitationDoc'],
    ['isDatingInvitationDocForBilling', 'isPrivateInvitationDocForBilling'],
    ['datingInvitationPreference', 'privateInvitationPreference'],

    // Constants
    ['DATING_INVITATION_PUBLISH_CREDITS', 'PRIVATE_INVITATION_PUBLISH_CREDITS'],
    ['CREDIT_COSTS.DATING_INVITATION', 'CREDIT_COSTS.PRIVATE_INVITATION'],
    ['dating_invitation_publish', 'private_invitation_publish'],
    ['DATING_MAX_GUESTS', 'PRIVATE_MAX_GUESTS'],

    // State / props
    ['datingInviteeProfile', 'privateInviteeProfile'],
    ['datingCardThemeColor', 'privateCardThemeColor'],
    ['datingCardShowHostAndMessage', 'privateCardShowHostAndMessage'],
    ['datingCardTextBackdropTone', 'privateCardTextBackdropTone'],
    ['isDatingInvitation', 'isPrivateInvitation'],
    ['liveDatingContextForUi', 'livePrivateContextForUi'],
    ['datingContextReady', 'privateContextReady'],
    ['datingPrerequisiteMessage', 'privatePrerequisiteMessage'],
    ['acceptsDating', 'acceptsPrivateInvite'],
    ['datingAiContext', 'privateAiContext'],
    ['getDatingAiContext', 'getPrivateAiContext'],
    ['handleDatingInvite', 'handlePrivateInvite'],
    ['handleDatingInviteesChange', 'handlePrivateInviteesChange'],
    ['buildDatingInvitationAiUserPrompt', 'buildPrivateInvitationAiUserPrompt'],
    ['buildDatingInvitationSystemInstruction', 'buildPrivateInvitationSystemInstruction'],
    ['buildDatingInvitationContextLines', 'buildPrivateInvitationContextLines'],
    ['createDatingAiContextFromForm', 'createPrivateAiContextFromForm'],
    ['validateDatingAiContext', 'validatePrivateAiContext'],
    ['buildDatingAiGenerateBody', 'buildPrivateAiGenerateBody'],
    ['parseDatingTextContext', 'parsePrivateTextContext'],
    ['resolveDatingInvitationPersonalization', 'resolvePrivateInvitationPersonalization'],
    ['getDatingCardBackgroundOptions', 'getPrivateCardBackgroundOptions'],
    ['resolveDatingCardBackgroundUrlCandidates', 'resolvePrivateCardBackgroundUrlCandidates'],
    ['getDatingInvitationHeroCoverFromInvitation', 'getPrivateInvitationHeroCoverFromInvitation'],
    ['getFirstDatingBackgroundFileUrl', 'getFirstPrivateBackgroundFileUrl'],
    ['resolveCanonicalDatingBackgroundId', 'resolveCanonicalPrivateBackgroundId'],
    ['DATING_CARD_BACKGROUNDS', 'PRIVATE_CARD_BACKGROUNDS'],
    ['DATING_DARK_TEMPLATE_BACKGROUND_IDS', 'PRIVATE_DARK_TEMPLATE_BACKGROUND_IDS'],

    // inviteCategory resolver return value
    ["return 'dating'", "return 'private'"],

    // CSS
    ['private-invitation-editor-footer--dating', 'private-invitation-editor-footer--private'],
    ['dating-', 'private-'],

    // i18n keys dating_* → private_*
    ["t('dating_", "t('private_"],
    ['"dating_', '"private_'],
    ["'dating_", "'private_"],
    ['"Dating"', '"Private"'],
    ['دعوة موعد', 'دعوة خاصة'],
    ['دعوات المواعدة', 'دعوات خاصة'],
    ['دعوة مواعدة', 'دعوة خاصة'],
    ['المواعدة', 'دعوة خاصة'],
    ['مواعدة', 'خاصة'],

    // Product copy EN
    ['Dating invitation', 'Private Invite'],
    ['Dating Invitation', 'Private Invite'],
    ['Dating Invitations', 'Private Invites'],
    ['date invitation', 'private invite'],
    ['Date invite', 'Private invite'],
    ['DineBuddy Date', 'Private Invite'],
    ['dating invitations', 'private invites'],
    ['dating invitation', 'private invite'],

    // Selector / hub
    ['invite_create_dating_', 'invite_create_private_'],
    ['type_dating', 'type_private'],
    ['occasion_dating', 'occasion_private'],
    ['admin_invitations_type_dating', 'admin_invitations_type_private'],
    ['unhandled_invitations_reminder_dating_label', 'unhandled_invitations_reminder_private_label'],
    ['sync:dating-templates', 'sync:private-templates'],

    // AI
    ['dating_context_incomplete', 'private_context_incomplete'],
    ['ai_prompt_dating_', 'ai_prompt_private_'],
    ['ai_design_use_invitation_dating', 'ai_design_use_invitation_private'],

    // InvitationCategory type (targeted)
    ["InvitationCategory'] = 'dating'", "InvitationCategory'] = 'private'"],
    ["category: 'dating'", "category: 'private'"],
    ["variant: 'dating'", "variant: 'private'"],
    ["mode: 'dating'", "mode: 'private'"],
    ["cardTemplateSet: 'dating'", "cardTemplateSet: 'private'"],
    ["templateVariant: 'dating'", "templateVariant: 'private'"],
    ['DRAFT_KIND_STORAGE_KEY', 'DRAFT_KIND_STORAGE_KEY'],
];

const TREE_ROOTS = ['src', 'api', 'functions', 'firestore.rules', 'firebase.json', 'vercel.json', 'package.json'];

console.log(DRY ? '=== DRY RUN ===' : '=== APPLYING REFACTOR ===');

console.log('\n--- STEP 1: file renames ---');
for (const [from, to] of step1Renames) {
    renameFile(path.join(ROOT, from), path.join(ROOT, to));
}
renameFilesInDir(path.join(ROOT, 'src/components/Invitations/socialCard'), [
    ['PrivateInvitation', 'SocialInvitation'],
    ['PrivateCard', 'SocialCard'],
    ['privateCard', 'socialCard'],
    ['HostPrivate', 'HostSocial'],
    ['buildPrivateInvitation', 'buildSocialInvitation'],
]);

console.log('\n--- STEP 1: text replacements ---');
const s1changed = replaceInTree(step1Replacements, TREE_ROOTS);
console.log('changed', s1changed.length, 'files');

console.log('\n--- STEP 2: file renames ---');
for (const [from, to] of step2Renames) {
    renameFile(path.join(ROOT, from), path.join(ROOT, to));
}
renameFilesInDir(path.join(ROOT, 'src/components/Invitations/privateCard'), [
    ['Dating', 'Private'],
    ['datingCard', 'privateCard'],
]);
renameFilesInDir(path.join(ROOT, 'src/components/Invitations/socialCard'), [
    ['Dating', 'Private'],
    ['PrivateCardDating', 'PrivateCard'],
]);

console.log('\n--- STEP 2: text replacements ---');
const s2changed = replaceInTree(step2Replacements, TREE_ROOTS);
console.log('changed', s2changed.length, 'files');

// Locale files separately (all keys)
console.log('\n--- Locales ---');
const localeDir = path.join(ROOT, 'src/locales');
if (fs.existsSync(localeDir)) {
    for (const file of fs.readdirSync(localeDir).filter((f) => f.endsWith('.json'))) {
        const full = path.join(localeDir, file);
        let text = fs.readFileSync(full, 'utf8');
        const orig = text;
        // Step 1 key renames in JSON
        text = text.replace(/"private_/g, '"social_');
        // Step 2 key renames
        text = text.replace(/"dating_/g, '"private_');
        // Step 2: social-specific product keys that should stay social
        // (private_ keys from dating_* are correct for new private invite)
        if (text !== orig && !DRY) fs.writeFileSync(full, text, 'utf8');
        if (text !== orig) console.log('locale:', file);
    }
}

console.log('\nDone.');
