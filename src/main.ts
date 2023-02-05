import * as ethers from 'ethers'
import * as fs from 'fs'
import request from 'request'
import * as matrix from "matrix-js-sdk"
import * as crypto from 'node:crypto'

const QUESTING_ADDR = '0x737eaF14061fE68f04ff4cA8205ACf538555fCC8';
const QUESTING_IMPL_ADDR = '0xaFe026A9B546C6E6C6ccB91295fdd9cbB8cB401d';
const LEGION_ID = 29089
const ROOM_ID = '!yzvGFyqyPjGLhXPDfP:matrix.org'

let provider = new ethers.providers.JsonRpcProvider(
	`https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
)

// quest finished - status == Idle
// quest ended - empty list of advancedQuests
async function re_quest(wallet: ethers.Wallet) {
	console.log('Walking the legion ...')
	let iface = new ethers.utils.Interface(fs.readFileSync(process.env.ABI_FILE as string).toString())

	let questing = new ethers.Contract(
		QUESTING_ADDR, iface, wallet
    )                                                                              
                                                                                   
    await questing.endQuesting([LEGION_ID], [true])                                
}                                                                                  
                                                                                   
function _hashPassword (password: string, salt: Buffer) {                          
    return crypto.scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 36000000 })
}

function decrypt_key () {
	let password = process.env.DECRYPT_PASSWORD
	if (!password) throw new Error('Missing decrypt password')
	let crypt_obj = JSON.parse(fs.readFileSync(process.env.KEYCHAIN_FILE as string).toString())
	let string = crypt_obj.encryptedKeys
	const parts = string.split(':')
    const salt = Buffer.from(parts.shift(), 'hex')
    const iv = Buffer.from(parts.shift(), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', _hashPassword(password, salt), iv)
    const encryptedString = Buffer.from(parts.join(':'), 'hex')
    const decrypted = Buffer.concat([decipher.update(encryptedString), decipher.final()])
	// console.log('privkey', decrypted.toString('base64'))
    return decrypted.toString()
}

async function transfer_magic_away(w: ethers.Wallet) {
	let magic = new ethers.Contract(
		'0x539bdE0d7Dbd336b79148AA742883198BBF60342',
		[
			'function transfer(address recipient, uint256 amount) external returns (bool)',
			'function decimals() view returns (uint8)',
			'function balanceOf(address account) external view returns (uint256)'
		],
		w
	)

	let dec = await magic.decimals()
	let balance = await magic.balanceOf(w.address)
	await magic.transfer('', balance)
	//ethers.BigNumber.from(445).mul(100).add(30).mul(ethers.BigNumber.from(10).pow(dec))
}

async function main() {
	let privkey = decrypt_key()
	let w = new ethers.Wallet(privkey, provider)
	//await transfer_magic_away(w)

	console.log(w.address)
	console.log(await legion_status(w.address))
	let chat = await chat_connect()

	loop_handler(chat, w)
	setInterval(() => {
		loop_handler(chat, w)
	}, 1000 * 60 * 60 * 2)
}

function loop_handler(chat: matrix.MatrixClient, wallet: ethers.Wallet) {
	loop(chat, wallet).then((res) => {
		// nothing
	}, (err) => {
		console.error('a problem', err)
		chat_send(chat, err.toString() + err.stack)
	})

}

async function loop(chat: matrix.MatrixClient, wallet: ethers.Wallet) {
	let legion = await legion_status(wallet.address)
	console.log('Legion status', legion.advancedQuests)
	let endsAt = legion.advancedQuests[0].endTimestamp
	let now = Date.now()
	if (!endsAt) throw new Error('End timestamp for quest 0 not found')
	endsAt = parseInt(endsAt)
	console.log(`endsAt=${endsAt} now=${now}`)
	if ((endsAt == 0) || (endsAt <= now)){
		await chat_send(chat, 'walking the legion ...')
		await re_quest(wallet)
	}

	return
}

async function legion_status(owner: string) {
	let resp = await fetch('https://api.thegraph.com/subgraphs/name/treasureproject/bridgeworld', {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(
			{
			"query": `
			query GetUserCollections($id: ID!) {
  atlasMines {
    utilization
  }
  summoningCircle(id: "only") {
    successRate
  }
  user(id: $id) {
    id
    recruit {
      ...TokenFragmentForLegions
    }
    summons(
      orderBy: endTimestamp
      orderDirection: desc
      where: {status_not: Finished}
    ) {
      id
      endTimestamp
      status
      success
      token {
        ...TokenFragmentForLegions
      }
    }
    quests(first: 200, orderBy: endTimestamp, orderDirection: desc) {
      id
      difficulty
      endTimestamp
      status
      token {
        ...TokenFragmentForLegions
      }
      reward {
        crystalShards
        id
        starlights
        universalLocks
        treasure {
          image
          name
        }
      }
    }
    advancedQuests(
      first: 1000
      orderBy: endTimestamp
      orderDirection: asc
      where: {status: Idle}
    ) {
      ...AdvancedQuestFragment
    }
    crafts(first: 200, orderBy: endTimestamp, orderDirection: desc) {
      endTimestamp
      difficulty
      outcome {
        magicReturned
        reward {
          id
          image
          name
        }
        success
        broken {
          id
          quantity
          token {
            image
            id
            name
            tokenId
          }
        }
      }
      status
      token {
        ...TokenFragmentForLegions
      }
    }
    miniCrafts(first: 200, orderBy: blockNumber, orderDirection: desc) {
      blockNumber
      timestamp
      tier
      token {
        ...TokenFragment
      }
      outcome {
        reward {
          tokenId
          image
          name
        }
      }
    }
    pilgrimaging {
      id
      quantity
      endTimestamp
      pilgrimageId
      token {
        name
      }
    }
    tokens(first: 1000) {
      id
      token {
        ...TokenFragment
      }
      quantity
      user {
        id
      }
    }
    deposited
    boost
    boosts
  }
}

fragment TokenFragmentForLegions on Token {
  image
  imageAlt
  imageNoBackground
  id
  name
  generation
  rarity
  tokenId
  metadata {
    __typename
    ... on LegionInfo {
      ...LegionMetadata
    }
  }
}

fragment LegionMetadata on LegionInfo {
  ...Constellation
  id
  cooldown
  summons
  questing
  crafting
  questingXp
  craftingXp
  role
  boost
  harvestersRank
  harvestersWeight
  type
  miniCraftsCompleted
  majorCraftsCompleted
  questsDistanceTravelled
  recruitLevel
  recruitXp
}

fragment Constellation on LegionInfo {
  constellation {
    dark
    earth
    fire
    light
    water
    wind
  }
}

fragment AdvancedQuestFragment on AdvancedQuest {
  id
  zoneName
  part
  status
  requestId
  endTimestamp
  stasisHitCount
  hadStasisPart2
  hadStasisPart3
  token {
    ...TokenFragmentForLegions
  }
  treasures {
    quantity
    token {
      tokenId
      name
      image
      metadata {
        __typename
        ... on TreasureInfo {
          category
        }
      }
    }
  }
  treasureTriadResult {
    playerWon
    numberOfCardsFlipped
    numberOfCorruptedCardsRemaining
  }
}

fragment TokenFragment on Token {
  metadata {
    __typename
    ... on LegionInfo {
      ...LegionMetadata
    }
    ... on TreasureInfo {
      id
      category
      tier
      boost
    }
    ... on ConsumableInfo {
      id
      type
      size
    }
    ... on TreasureFragmentInfo {
      id
      categories
      tier
    }
  }
  category
  contract
  image
  imageAlt
  imageNoBackground
  generation
  rarity
  name
  tokenId
  harvesterBoosts {
    harvester {
      id
    }
    boost
  }
}

`,
"variables":{
	"id": owner.toLowerCase()
},"operationName":"GetUserCollections"
			}
							)
	})
	let json = await resp.json()
	return json.data.user
}

function chat_connect(): Promise<matrix.MatrixClient> {
	matrix.request(request)

	let promise = new Promise<matrix.MatrixClient>((resolve, reject) => {

		const rawClient = matrix.createClient("https://matrix.org").loginWithPassword(
			`@${process.env.CHAT_USERNAME}:matrix.org`,
			process.env.CHAT_PASSWORD as string,
			(err, res) => {
				const authClient = matrix.createClient({
					baseUrl: 'https://matrix.org',
					accessToken: res.access_token,
					userId: res.user_id
				})
				console.log('Connected matrix')
				resolve(authClient)
			})
	})

	return promise
}

async function chat_send(client: matrix.MatrixClient, msg: string) {
	await client.sendMessage(ROOM_ID, {
		body:msg,
		msgtype: 'm.text'
	})
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});

