**Question**:

- The spymaster is worried that this design is not private.

- Is he correct ?

- How could you change the system to ensure that messages are private ?

**Answer**
Yes, the spymaster is correct. All blockchain data and user inputs are public, so the message and security code are exposed. 

To protect this information, we should hash the security code and create a zero-knowledge proof off-chain using zkProgram. Then, we can submit this proof to the smart contract to maintain confidentiality and verify the security code without exposing it.
