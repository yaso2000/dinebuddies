# Delete All Invitations - Firebase CLI Commands

## Prerequisites:
# Install Firebase CLI if not installed:
# npm install -g firebase-tools

## Login to Firebase:
# firebase login

## Delete all invitations collection:
firebase firestore:delete invitations --recursive --yes

## Delete invitation-related notifications:
# This is more complex, you may need to do it manually or use the script

## Notes:
# - This will delete ALL invitations permanently
# - This cannot be undone
# - Make sure you're in the correct project
