import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY || 
  '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC4A4YnNE1Rvqcv\ncbZ9KGPCp79bCHip6fmxPLaWZJ75CNdZbERub8PGUhPcQb2ViIDE5mD9ZPsx46z9\nmyz7HjlQiZzLOH5KVdPzFIGhIHr6cTLYQwxl+nhmxzr2p8b29uvTFcagqCx9Tj4I\nueS++6X8hHRFrSRpOfcPj7XH9477LuwPWVCoVJeYMrnV391V4zqG7t6z/8h4fi2X\nqVVbAEbebrfp7YRkP/OxAACGR9dlJbUPpcsGxNbL01q5yag15p2GPwWMzlYJtXdv\nmwyefQBiLIsdgtg5BhAPnFuKMv7nWWr+Rdnj28rjcQQ9wHWTOdCtFJUrn4Uu+jNs\nwdvzfpSFAgMBAAECggEAK9RbDdd9Wy0oMTrKlsEaEfFWuN4pr38VhEvLycKpwvOC\nJ8CMBCoG3aQLKvlVqNpcoYmmLHTzCA0M1VMywZWPXUmJ2TXZjucmls2ZmsFbyW9R\nBwXhXCDusLxfpQSNdaGWxi53oyirgCU0zWtJutvBy4XZFAeLlqzB1ikKyViD6/v3\nbMyOsGS0oIKDCBh+86IpfWvxtxJdrrnk4u28T1/lCha2BrPiUkpoEfqh9sJVVLol\niIpLYULZEE4HgL/6P2LqH1rdrKiiPeKngijKw8GRISZqrdfHOo+AtNnU4YTJeqav\ncSR9TBL3qk3cn5xnKdyHm15m57gjCWrWWqTrHy3bwQKBgQDrg0n1vnL0T8K99/eG\neaPmdGR93vR9sj2irfs6m5QoW2Yfi9tD4nnHfhriJ4Y3UBLONWTyE8XLeSAKz/mm\ntj++yrLQuwgXwNPt1BHnyqQV0I2FQ/CoFeCbzVQQCLFVu6mS+Rij+mwy3CI1D4Mr\n661+fPX1byGc1uJhfsBE6BCb/QKBgQDIBWK0/4n7GZ0oAUXujkwq2azuJgZTtfUs\n/pAryQd7yzq1/rmDN91r7AD3YauuVSwvly5h9b9obADzorY1h3Bl7Xwu7F6l0vwl\n2dmNlIGOhY70MxLG+gD12Ak51m4HxgngfD1oBS4QlB+xq3N1syoHmoVhWYTIeGcR\nPcDyMVzNKQKBgQDa5HupXAmb6UYnKoF1Czm6yBNeqgqziSagPPRz1IYvvEN+ro5s\n2eI1+I8kA3hLkLDp19aq6JW+OCX/5q0ytdEpk1v/hNZQvXg8ZA8AUOeRHvVqF2tl\nzm+kX4LyJCIufO1vHPY58lb+LnvctT5FZBcsqRgxtciX7WEbHKO3Z7mIQQKBgQDB\nU/ND3noPKYKs2A4vtXoJMLvksvwKjSSciK/woi2JibUFk17bZXOujD2i3dSCe/Bp\nT0aViGGpHDsPQYW711zcJ96PvAb/YB42t4l/Prq6dnzlqzfK+nlTJaxFKuzOtqt1\nPqBbmiYcAA9iOsUuTi2hi8i/fzbITRfRok6LyQpZgQKBgF50bx4GhoghsuWG+BdP\noMA7sH1S01dg14pUe8Ea71domniPHEY5nCmP4Ug86Y0e1/x03nqAbm4EQijs4ajm\nBjg9uQ1DpDEiADmqp3e+WFv+Ig0S2UhrqOj8FWm7mK1+Q+HuqJvbL7Xp7LW4uT3P\nUi7Pa6Eu0debIS/LbxMLrfab\n-----END PRIVATE KEY-----';

process.env.JWT_ISSUER = 'https://test.unsent-letters.example';
process.env.JWT_AUDIENCE = 'unsent-letters-test';
process.env.JWT_EXPIRES_IN = '3600';

// Disable console.log in tests unless explicitly needed
if (process.env.VERBOSE_TESTS !== 'true') {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
}