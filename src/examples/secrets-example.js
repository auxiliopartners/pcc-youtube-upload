import {createClient} from '@1password/sdk'
import 'dotenv/config'
import logger from '../../utils/logger.js'
import {name, version} from '../../utils/package.js'

/**
 * Example usage of the 1Password SDK for secret management
 * Run this file with: node src/examples/secrets-example.js
 *
 * Prerequisites:
 * 1. Create a service account at https://developer.1password.com/
 * 2. Set OP_SERVICE_ACCOUNT_TOKEN in your .env file
 * 3. Create a vault and add some items to test with
 */

async function demonstrateSecretRetrieval() {
  const token = process.env.OP_SERVICE_ACCOUNT_TOKEN

  if (!token) {
    logger.error('OP_SERVICE_ACCOUNT_TOKEN not found in environment variables')
    logger.info('Please set OP_SERVICE_ACCOUNT_TOKEN in your .env file')
    logger.info('Get a service account token from https://developer.1password.com/')
    return
  }

  try {
    // Initialize the 1Password client with project metadata from package.json
    const client = await createClient({
      auth: token,
      integrationName: name,
      integrationVersion: version,
    })

    logger.info('1Password client initialized successfully')

    // Example: Retrieve a secret by reference
    // Reference format: op://vault-name/item-name/field-name
    // Update the reference below to match your actual vault/item/field names

    const secretReference = process.env.OP_SECRET_REFERENCE || 'op://Private/Example Item/password'

    logger.info({reference: secretReference}, 'Attempting to retrieve secret...')

    try {
      const secret = await client.secrets.resolve(secretReference)
      logger.info('✓ Secret retrieved successfully!')

      // NEVER log the actual secret value in production!
      logger.info({
        secretLength: secret.length,
        secretType: typeof secret,
        hasValue: secret.length > 0,
      }, 'Secret metadata')

      // Example: Using the secret in your application
      logger.info('Example usage patterns:')
      logger.info('1. Database connection: DATABASE_URL from 1Password')
      logger.info('2. API authentication: API_KEY from 1Password')
      logger.info('3. Service credentials: Use in configuration objects')

      // Example usage pattern:
      // const config = {
      //   apiKey: secret,
      //   apiEndpoint: 'https://api.example.com'
      // }
      // const response = await fetch(config.apiEndpoint, {
      //   headers: { 'Authorization': `Bearer ${config.apiKey}` }
      // })

      logger.info('1Password SDK example completed successfully')
    } catch (secretError) {
      logger.warn({
        err: secretError.message,
        reference: secretReference,
      }, 'Could not retrieve secret')

      logger.info('')
      logger.info('To test secret retrieval:')
      logger.info('1. Open 1Password and create a vault (e.g., "Private")')
      logger.info('2. Create an item in that vault (e.g., "Example Item")')
      logger.info('3. Add a field to store your secret (e.g., "password")')
      logger.info('4. Set OP_SECRET_REFERENCE in .env to point to your item:')
      logger.info('   OP_SECRET_REFERENCE=op://Private/Example Item/password')
      logger.info('5. Run this script again')
      logger.info('')
      logger.info('For more info: https://developer.1password.com/docs/sdks/secret-references')
    }
  } catch (error) {
    logger.error({err: error}, 'Failed to interact with 1Password')
    logger.info('Make sure your OP_SERVICE_ACCOUNT_TOKEN is valid and has proper permissions')
    logger.info('Create a service account at: https://developer.1password.com/')
  }
}

// Run the example
demonstrateSecretRetrieval().catch(error => {
  logger.error({err: error}, 'Unhandled error')
  process.exit(1)
})
