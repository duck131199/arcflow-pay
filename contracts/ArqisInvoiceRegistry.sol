// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ArqisInvoiceRegistry
/// @notice Non-custodial invoice/payment-reference proof registry for the Arqis Arc Testnet MVP.
/// @dev This contract records lightweight invoice metadata hashes and payment transaction references.
/// It does not hold funds, execute swaps/bridges, or verify token transfers by itself.
contract ArqisInvoiceRegistry {
    address public immutable projectOwner;

    struct Invoice {
        address seller;
        address payer;
        address token;
        uint256 amount;
        bytes32 memoHash;
        uint256 expiresAt;
        uint256 createdAt;
        bytes32 paymentTxHash;
        uint256 paymentRecordedAt;
        bool exists;
        bool paymentRecorded;
    }

    mapping(bytes32 => Invoice) private _invoices;

    event InvoiceCreated(
        bytes32 indexed invoiceId,
        address indexed seller,
        address indexed payer,
        address token,
        uint256 amount,
        bytes32 memoHash,
        uint256 expiresAt,
        uint256 createdAt
    );

    event PaymentRecorded(
        bytes32 indexed invoiceId,
        bytes32 indexed paymentTxHash,
        address indexed recorder,
        uint256 recordedAt
    );

    event ProjectOwnerSet(address indexed projectOwner);

    error InvalidProjectOwner();
    error InvoiceAlreadyExists(bytes32 invoiceId);
    error InvoiceNotFound(bytes32 invoiceId);
    error InvalidPayer();
    error InvalidToken();
    error InvalidAmount();
    error InvalidExpiry();
    error InvalidPaymentTxHash();
    error PaymentAlreadyRecorded(bytes32 invoiceId);
    error NotInvoiceParty(bytes32 invoiceId, address caller);

    constructor(address projectOwner_) {
        if (projectOwner_ == address(0)) revert InvalidProjectOwner();
        projectOwner = projectOwner_;
        emit ProjectOwnerSet(projectOwner_);
    }

    /// @notice Create an onchain proof record for an Arqis invoice.
    /// @param invoiceId App-generated invoice identifier, preferably keccak256 of the invoice reference.
    /// @param payer Intended payer wallet.
    /// @param token Settlement token address for the invoice, e.g. Arc Testnet USDC.
    /// @param amount Invoice amount in token base units.
    /// @param memoHash Hash of memo/order metadata; avoid putting private memo text directly onchain.
    /// @param expiresAt Unix timestamp when the invoice expires.
    function createInvoice(
        bytes32 invoiceId,
        address payer,
        address token,
        uint256 amount,
        bytes32 memoHash,
        uint256 expiresAt
    ) external {
        if (_invoices[invoiceId].exists) revert InvoiceAlreadyExists(invoiceId);
        if (payer == address(0)) revert InvalidPayer();
        if (token == address(0)) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        if (expiresAt <= block.timestamp) revert InvalidExpiry();

        _invoices[invoiceId] = Invoice({
            seller: msg.sender,
            payer: payer,
            token: token,
            amount: amount,
            memoHash: memoHash,
            expiresAt: expiresAt,
            createdAt: block.timestamp,
            paymentTxHash: bytes32(0),
            paymentRecordedAt: 0,
            exists: true,
            paymentRecorded: false
        });

        emit InvoiceCreated(invoiceId, msg.sender, payer, token, amount, memoHash, expiresAt, block.timestamp);
    }

    /// @notice Record a payment transaction reference for an existing invoice.
    /// @dev This records a reference only. It does not verify amount, recipient, token, or chain finality.
    /// @param invoiceId Existing invoice identifier.
    /// @param paymentTxHash Transaction hash/reference for the submitted payment.
    function recordPayment(bytes32 invoiceId, bytes32 paymentTxHash) external {
        Invoice storage invoice = _invoices[invoiceId];
        if (!invoice.exists) revert InvoiceNotFound(invoiceId);
        if (paymentTxHash == bytes32(0)) revert InvalidPaymentTxHash();
        if (invoice.paymentRecorded) revert PaymentAlreadyRecorded(invoiceId);
        if (msg.sender != invoice.seller && msg.sender != invoice.payer) {
            revert NotInvoiceParty(invoiceId, msg.sender);
        }

        invoice.paymentTxHash = paymentTxHash;
        invoice.paymentRecordedAt = block.timestamp;
        invoice.paymentRecorded = true;

        emit PaymentRecorded(invoiceId, paymentTxHash, msg.sender, block.timestamp);
    }

    /// @notice Return whether an invoice exists.
    function invoiceExists(bytes32 invoiceId) external view returns (bool) {
        return _invoices[invoiceId].exists;
    }

    /// @notice Read a registered invoice proof record.
    function getInvoice(bytes32 invoiceId) external view returns (Invoice memory) {
        Invoice memory invoice = _invoices[invoiceId];
        if (!invoice.exists) revert InvoiceNotFound(invoiceId);
        return invoice;
    }
}
